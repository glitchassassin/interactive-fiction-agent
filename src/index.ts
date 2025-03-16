import dotenv from "dotenv";
import { Command } from "commander";
import winston from "winston";
import { Agent } from "./agents/Agent.js";
import { SimpleAIAgent } from "./agents/SimpleAIAgent.js";
import { formatDuration, displayTable } from "./utils/index.js";
import {
  CLAUDE_3_HAIKU,
  DEEPSEEK_R1_14B,
  GEMMA_3_ENHANCED,
  MISTRAL,
  GPT_4O_MINI,
  GPT_O3_MINI,
  GROK_2,
  CLAUDE_3_SONNET,
  GPT_4O,
  DEEPSEEK_R1_TOOL_CALLING,
} from "./models.js";

// Load environment variables
dotenv.config();

// Initialize test agents
const agents: Agent[] = [
  new SimpleAIAgent(), // Use default MISTRAL model
  new SimpleAIAgent({ model: CLAUDE_3_HAIKU }),
  new SimpleAIAgent({ model: GEMMA_3_ENHANCED }),
  new SimpleAIAgent({ model: CLAUDE_3_SONNET }),
  new SimpleAIAgent({ model: DEEPSEEK_R1_TOOL_CALLING }),
  new SimpleAIAgent({ model: GROK_2 }),
  // new SimpleAIAgent({ model: GPT_4O_MINI }),
  // new SimpleAIAgent({ model: GPT_4O }),
  // new SimpleAIAgent({ model: GPT_O3_MINI }),
];

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
        logger.info(`Starting ${agent.name}`);
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
