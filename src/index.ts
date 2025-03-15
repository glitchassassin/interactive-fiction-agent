import dotenv from "dotenv";
import { ollama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import { Command } from "commander";
import winston from "winston";
import { Agent } from "./agents/Agent.js";
import { RandomAgent } from "./agents/RandomAgent.js";
import { SlowAgent } from "./agents/SlowAgent.js";
import { formatDuration, displayTable } from "./utils/index.js";

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Ollama models
const MISTRAL = ollama("mistral");
const GEMMA_3 = ollama("gemma3:12b");
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

// Initialize test agents
const agents: Agent[] = [new RandomAgent(), new SlowAgent()];

/**
 * Run agents with specified concurrency
 * @param agents The agents to run
 * @param maxConcurrent Maximum number of agents to run concurrently
 */
async function runAgents(
  agents: Agent[],
  maxConcurrent: number
): Promise<void> {
  logger.info(
    `Running ${agents.length} agents with max ${maxConcurrent} concurrent`
  );

  const startTime = Date.now();
  for (let i = 0; i < agents.length; i += maxConcurrent) {
    const batch = agents.slice(i, i + maxConcurrent);
    await Promise.all(
      batch.map(async (agent) => {
        const agentStartTime = Date.now();
        await agent.run();
        const agentEndTime = Date.now();
        const duration = agentEndTime - agentStartTime;
        logger.info(
          `Agent ${agent.name} completed in ${formatDuration(
            duration
          )} with score ${agent.score} and ${agent.moves} moves`
        );
      })
    );
  }
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  logger.info(`All agents completed in ${formatDuration(totalDuration)}`);
}

/**
 * Print a summary report of all agents' performance
 * @param agents The agents that were run
 * @param totalRuntime The total runtime in milliseconds
 */
function printSummaryReport(agents: Agent[], totalRuntime: number): void {
  logger.info("=== Summary Report ===");
  logger.info(`Total runtime: ${formatDuration(totalRuntime)}`);

  // Calculate averages
  const totalScore = agents.reduce((sum, agent) => sum + agent.score, 0);
  const totalMoves = agents.reduce((sum, agent) => sum + agent.moves, 0);
  const avgScore = totalScore / agents.length;
  const avgMoves = totalMoves / agents.length;

  logger.info(`Average score: ${avgScore.toFixed(2)}`);
  logger.info(`Average moves: ${avgMoves.toFixed(2)}`);

  // Prepare data for table display
  const tableData = agents.map((agent) => ({
    Name: agent.name,
    Score: agent.score,
    Moves: agent.moves,
  }));

  // Print individual agent results using our custom table display
  logger.info("\nIndividual Agent Results:");
  displayTable(tableData);
}

async function main() {
  // Create command-line interface
  const program = new Command();

  program
    .name("interactive-fiction-agent")
    .description("Run AI agents for interactive fiction games")
    .version("1.0.0");

  program
    .option("-a, --agent <names...>", "specify agent(s) to run by name")
    .option(
      "-m, --max-concurrent <number>",
      "maximum number of agents to run concurrently (defaults to 1, which runs in series)",
      (value) => parseInt(value),
      1
    )
    .option(
      "-l, --log-level <level>",
      "set log level (error, warn, info, debug)",
      "info"
    );

  program.parse(process.argv);

  const options = program.opts();

  // Set log level
  logger.level = options.logLevel;

  // Load agents
  let selectedAgents: Agent[] = agents.filter((agent) =>
    options.agent ? options.agent.includes(agent.name) : true
  );

  if (selectedAgents.length === 0) {
    logger.error("No agents found or specified");
    process.exit(1);
  }

  logger.info(`Loaded ${selectedAgents.length} agent(s)`);

  // Run agents
  const startTime = Date.now();

  await runAgents(selectedAgents, options.maxConcurrent);

  const endTime = Date.now();
  const totalRuntime = endTime - startTime;

  // Print summary report
  printSummaryReport(selectedAgents, totalRuntime);
}

main().catch((error) => {
  logger.error("An error occurred:", error);
  process.exit(1);
});
