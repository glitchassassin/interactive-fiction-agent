import dotenv from "dotenv";
import { SimpleWorkflow } from "./workflows/simple.js";
import { ReflectionWorkflow } from "./workflows/simple_reflection.js";
import { WorkflowRunner } from "./runner.js";
import winston from "winston";
import { ollama } from "ollama-ai-provider";

// Load environment variables
dotenv.config();

const MISTRAL = ollama("mistral");
const DEEPSEEK_R1 = ollama("deepseek-r1");
const DEEPSEEK_R1_14B = ollama("deepseek-r1:14b");

async function main() {
  // Create workflow instances with different configurations
  const workflows = [
    // Default configurations
    // new SimpleWorkflow(),
    // new ReflectionWorkflow(),
    new SimpleWorkflow({
      commandModel: MISTRAL,
    }),
    new ReflectionWorkflow({
      reflectionModel: MISTRAL,
      commandModel: MISTRAL,
    }),
    new SimpleWorkflow({
      commandModel: DEEPSEEK_R1,
    }),
    new ReflectionWorkflow({
      reflectionModel: DEEPSEEK_R1,
      commandModel: DEEPSEEK_R1,
    }),
    new SimpleWorkflow({
      commandModel: DEEPSEEK_R1_14B,
    }),
    new ReflectionWorkflow({
      reflectionModel: ollama("deepseek-r1:14b"),
      commandModel: ollama("deepseek-r1:14b"),
    }),

    // Custom configurations
    // new SimpleWorkflow({
    //   maxIterations: 50,
    //   displayName: "Simple Workflow (Short Run)",
    // }),
    // new ReflectionWorkflow({
    //   dialogueLimit: 100,
    //   maxIterations: 150,
    //   displayName: "Reflection Workflow (Extended Run)",
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

  mainLogger.info("\nResults Summary:");
  mainLogger.info("==============================");
  mainLogger.info(
    `Best performing workflow by score: ${bestByScore.displayName}`
  );
  mainLogger.info(
    `Most efficient workflow (score/moves): ${mostEfficient.displayName}`
  );
  mainLogger.info(`Fastest workflow: ${fastest.displayName}`);
  mainLogger.info(
    `Total execution time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`
  );
}

main().catch(console.error);
