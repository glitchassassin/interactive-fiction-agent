import dotenv from "dotenv";
import { SimpleWorkflow } from "./workflows/simple.js";
import { ReflectionWorkflow } from "./workflows/simple_reflection.js";
import { WorkflowRunner } from "./runner.js";
import winston from "winston";
import { ollama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";

// Load environment variables
dotenv.config();

// Ollama models
const MISTRAL = ollama("mistral");
const DEEPSEEK_R1_14B = ollama("deepseek-r1:14b");

// OpenAI models
// $2.50 / $10.00 per million tokens in/out
const GPT_4O = openai("gpt-4o");
// $0.150 / $0.600 per million tokens in/out
const GPT_4O_MINI = openai("gpt-4o-mini");
// $1.10 / $4.40 per million tokens in/out
const GPT_O3_MINI = openai("o3-mini");

// Anthropic models
// $0.80 / $4.00 per million tokens in/out
const CLAUDE_3_HAIKU = anthropic("claude-3-5-haiku-20241022");
// $3.00 / $15.00	 per million tokens in/out
const CLAUDE_3_SONNET = anthropic("claude-3-7-sonnet-20250219");

// Grok models
// $2.00 / $10.00 per million tokens in/out
const GROK_2 = xai("grok-2-1212");

async function main() {
  // Create workflow instances with different configurations
  const workflows = [
    // // Ollama models
    // new SimpleWorkflow({
    //   commandModel: MISTRAL,
    // }),
    // new SimpleWorkflow({
    //   commandModel: DEEPSEEK_R1_14B,
    // }),

    // // OpenAI models
    // new SimpleWorkflow({
    //   commandModel: GPT_4O,
    // }),
    // new SimpleWorkflow({
    //   commandModel: GPT_4O_MINI,
    // }),
    // new SimpleWorkflow({
    //   commandModel: GPT_O3_MINI,
    // }),

    // // Anthropic models
    new SimpleWorkflow({
      commandModel: CLAUDE_3_HAIKU,
    }),
    // new SimpleWorkflow({
    //   commandModel: CLAUDE_3_SONNET,
    // }),

    // Grok models
    // new SimpleWorkflow({
    //   commandModel: GROK_2,
    // }),

    // Local models
    new SimpleWorkflow({
      commandModel: MISTRAL,
    }),
    // new SimpleWorkflow({
    //   commandModel: DEEPSEEK_R1_14B,
    // }),
  ];

  // Create a logger for the main application
  const mainLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message }) => {
        return `[Main] ${level}: ${message}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const parallel = args.includes("--parallel");
  const maxConcurrent = args.includes("--max-concurrent")
    ? parseInt(args[args.indexOf("--max-concurrent") + 1], 10)
    : 0;

  mainLogger.info(`Execution mode: ${parallel ? "Parallel" : "Sequential"}`);
  if (parallel && maxConcurrent > 0) {
    mainLogger.info(`Max concurrent workflows: ${maxConcurrent}`);
  }

  // Create a workflow runner with logging options
  const runner = new WorkflowRunner(workflows, {
    logDir: "./logs",
    saveLogs: true,
    logLevel: "info",
    parallel,
    maxConcurrent,
  });

  // Run all workflows
  const startTime = Date.now();
  const results = await runner.runAll();
  const totalTime = Date.now() - startTime;

  // Display results table
  mainLogger.info(`
Workflow Comparison Results:
==============================
${WorkflowRunner.formatResultsTable(results)}`);

  // Find the best performing workflow by score
  const bestByScore = results.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  // Find the most efficient workflow (highest score per move)
  const mostEfficient = results.reduce((best, current) => {
    // Avoid division by zero
    if (current.moves === 0) return best;
    if (best.moves === 0) return current;

    return current.score / current.moves > best.score / best.moves
      ? current
      : best;
  });

  // Find the fastest workflow
  const fastest = results.reduce((best, current) =>
    current.executionTimeMs < best.executionTimeMs ? current : best
  );

  // Find the most token-efficient workflow (highest score per token)
  const mostTokenEfficient = results.reduce((best, current) => {
    // Avoid division by zero
    if (current.usage.totalTokens === 0) return best;
    if (best.usage.totalTokens === 0) return current;

    return current.score / current.usage.totalTokens >
      best.score / best.usage.totalTokens
      ? current
      : best;
  });

  // Find the most cost-efficient workflow (highest score per dollar)
  const mostCostEfficient = results.reduce((best, current) => {
    // Avoid division by zero
    if (current.estimatedCost === 0) return best;
    if (best.estimatedCost === 0) return current;

    return current.score / current.estimatedCost >
      best.score / best.estimatedCost
      ? current
      : best;
  });

  // Calculate total token usage and cost
  const totalTokens = results.reduce(
    (sum, result) => sum + result.usage.totalTokens,
    0
  );

  const totalCost = results.reduce(
    (sum, result) => sum + result.estimatedCost,
    0
  );

  mainLogger.info("\nResults Summary:");
  mainLogger.info("==============================");
  mainLogger.info(
    `Best performing workflow by score: ${bestByScore.displayName}`
  );
  mainLogger.info(
    `Most efficient workflow (score/moves): ${mostEfficient.displayName}`
  );
  mainLogger.info(
    `Most token-efficient workflow (score/token): ${mostTokenEfficient.displayName}`
  );
  mainLogger.info(
    `Most cost-efficient workflow (score/$): ${mostCostEfficient.displayName}`
  );
  mainLogger.info(`Fastest workflow: ${fastest.displayName}`);
  mainLogger.info(
    `Total execution time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`
  );
  mainLogger.info(`Total tokens used: ${totalTokens.toLocaleString()}`);
  mainLogger.info(`Total estimated cost: $${totalCost.toFixed(6)}`);
}

main().catch(console.error);
