import dotenv from "dotenv";
import { SimpleWorkflow } from "./workflows/simple.js";
import { ReflectionWorkflow } from "./workflows/simple_reflection.js";
import { WorkflowRunner } from "./runners/workflow.js";
import { AgentRunner } from "./runners/agent.js";
import winston from "winston";
import { ollama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import { SimpleReasoningWorkflow } from "./workflows/simple_reasoning.js";
import { AgentBasedWorkflow } from "./workflows/agent-based.js";
import { AgentOrchestrator } from "./agents/agent-orchestrator.js";
import { MemoryAgent } from "./agents/memory/memory-agent.js";
import { GoalAgent } from "./agents/tools/goal-agent.js";
import { PuzzleSolverAgent } from "./agents/tools/puzzle-solver.js";
import { MapAgent } from "./agents/tools/map-agent.js";

// Load environment variables
dotenv.config();

// Ollama models
const MISTRAL = ollama("mistral");
const DEEPSEEK_R1 = ollama("deepseek-r1");
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

async function runWorkflows() {
  // Create workflow instances with different configurations
  const workflows = [
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
    // new SimpleWorkflow({
    //   commandModel: CLAUDE_3_HAIKU,
    // }),
    // new SimpleReasoningWorkflow({
    //   commandModel: CLAUDE_3_HAIKU,
    // }),
    new ReflectionWorkflow({
      commandModel: MISTRAL,
      reflectionModel: CLAUDE_3_HAIKU,
    }),
    // new SimpleWorkflow({
    //   commandModel: CLAUDE_3_SONNET,
    // }),

    // Grok models
    // new SimpleWorkflow({
    //   commandModel: GROK_2,
    // }),

    // Local models
    // new SimpleWorkflow({
    //   commandModel: MISTRAL,
    // }),
    // new SimpleReasoningWorkflow({
    //   commandModel: MISTRAL,
    //   dialogueLimit: 5,
    // }),
    // new SimpleWorkflow({
    //   commandModel: DEEPSEEK_R1_14B,
    // }),
    // new SimpleReasoningWorkflow({
    //   commandModel: DEEPSEEK_R1_14B,
    // }),
    // new ReflectionWorkflow({
    //   commandModel: MISTRAL,
    //   reflectionModel: DEEPSEEK_R1_14B,
    //   dialogueLimit: 10,
    // }),

    // Agent-based workflows
    new AgentBasedWorkflow({
      mainModel: CLAUDE_3_HAIKU,
      memoryModel: MISTRAL,
      goalModel: MISTRAL,
      puzzleModel: MISTRAL,
      mapModel: MISTRAL,
    }),
    new AgentBasedWorkflow({
      mainModel: CLAUDE_3_SONNET,
    }),
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

async function runAgentOrchestrator() {
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
  const interactive = args.includes("--interactive");

  // Create specialized agents
  const memoryAgent = new MemoryAgent({
    model: MISTRAL,
    displayName: "Memory Agent",
  });

  const goalAgent = new GoalAgent({
    model: MISTRAL,
    displayName: "Goal Agent",
  });

  const puzzleAgent = new PuzzleSolverAgent({
    model: MISTRAL,
    displayName: "Puzzle Agent",
  });

  const mapAgent = new MapAgent({
    model: MISTRAL,
    displayName: "Map Agent",
  });

  // Create the agent orchestrator
  const orchestrator = new AgentOrchestrator({
    model: CLAUDE_3_SONNET,
    memoryModel: MISTRAL,
    goalModel: MISTRAL,
    puzzleModel: MISTRAL,
    mapModel: MISTRAL,
  });

  // Create the agent runner
  const runner = new AgentRunner(orchestrator, {
    logDir: "./logs",
    saveLogs: true,
    logLevel: "info",
    maxIterations: 100,
    interactive,
  });

  // Run the agent
  const startTime = Date.now();
  const result = await runner.run();
  const totalTime = Date.now() - startTime;

  // Display results
  mainLogger.info("\nAgent Run Results:");
  mainLogger.info("==============================");
  mainLogger.info(`Agent: ${result.agentName}`);
  mainLogger.info(`Score: ${result.score}`);
  mainLogger.info(`Moves: ${result.moves}`);
  mainLogger.info(`Completed: ${result.completed ? "Yes" : "No"}`);
  mainLogger.info(
    `Execution time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`
  );
  mainLogger.info(
    `Total tokens used: ${result.usage.totalTokens.toLocaleString()}`
  );
  mainLogger.info(`Estimated cost: $${result.estimatedCost.toFixed(6)}`);
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const runMode = args.includes("--agent") ? "agent" : "workflow";

  if (runMode === "agent") {
    await runAgentOrchestrator();
  } else {
    await runWorkflows();
  }
}

main().catch(console.error);
