import fs from "fs";
import path from "path";
import winston from "winston";
import readline from "readline";
import { AgentOrchestrator } from "../agents/agent-orchestrator.js";
import { LanguageModelUsage } from "../workflows/base.js";

/**
 * Result of an agent run including performance metrics
 */
export interface AgentResult {
  /** Name of the agent */
  agentName: string;
  /** Final score achieved in the game */
  score: number;
  /** Number of moves made during the game */
  moves: number;
  /** Whether the game completed naturally or timed out */
  completed: boolean;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
  /** Language model usage statistics */
  usage: LanguageModelUsage;
  /** Estimated cost in USD */
  estimatedCost: number;
}

/**
 * Options for the agent runner
 */
export interface AgentRunnerOptions {
  /** Directory to save log files to */
  logDir?: string;
  /** Whether to save logs to files */
  saveLogs?: boolean;
  /** Log level to use */
  logLevel?: string;
  /** Maximum number of iterations to run */
  maxIterations?: number;
  /** Whether to run in interactive mode */
  interactive?: boolean;
}

/**
 * Runs an agent orchestrator directly
 */
export class AgentRunner {
  private readonly agent: AgentOrchestrator;
  private readonly options: Required<AgentRunnerOptions>;
  private readonly logger: winston.Logger;
  private rl: readline.Interface | null = null;

  /**
   * Creates a new agent runner
   * @param agent The agent orchestrator to run
   * @param options Configuration options
   */
  constructor(agent: AgentOrchestrator, options: AgentRunnerOptions = {}) {
    this.agent = agent;
    this.options = {
      logDir: options.logDir ?? "./logs",
      saveLogs: options.saveLogs ?? true,
      logLevel: options.logLevel ?? "info",
      maxIterations: options.maxIterations ?? 100,
      interactive: options.interactive ?? false,
    };

    // Ensure log directory exists if saving logs
    if (this.options.saveLogs) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }

    // Create logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [AgentRunner] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message }) => {
              return `[AgentRunner] ${level}: ${message}`;
            })
          ),
        }),
      ],
    });

    // Add file transport if saving logs
    if (this.options.saveLogs) {
      const logFilename = path.join(
        this.options.logDir,
        `agent_${Date.now()}.log`
      );
      this.logger.add(
        new winston.transports.File({
          filename: logFilename,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
      this.logger.info(`Logging to ${logFilename}`);
    }
  }

  /**
   * Run the agent
   * @returns The result of the agent run
   */
  async run(): Promise<AgentResult> {
    this.logger.info(`Starting agent: ${this.agent.constructor.name}`);
    const startTime = Date.now();

    try {
      // Start the game
      this.logger.info("Starting game...");
      const initialResponse = await this.agent.startGame();
      this.logger.info(`Initial game response: ${initialResponse}`);

      if (this.options.interactive) {
        await this.runInteractive();
      } else {
        await this.runAutonomous();
      }

      // Get final game state
      const gameState = this.agent.getGameState();
      const executionTimeMs = Date.now() - startTime;
      const usage = this.agent.getTotalTokenUsage();
      const estimatedCost = this.agent.calculateTotalCost();

      this.logger.info(`Agent run completed`);
      this.logger.info(
        `Score: ${gameState.score}, Moves: ${
          gameState.moves
        }, Time: ${executionTimeMs}ms, Tokens: ${
          usage.totalTokens
        }, Cost: $${estimatedCost.toFixed(6)}`
      );

      return {
        agentName: this.agent.constructor.name,
        score: gameState.score,
        moves: gameState.moves,
        completed: true,
        executionTimeMs,
        usage,
        estimatedCost,
      };
    } catch (error) {
      this.logger.error(`Error running agent: ${error}`);
      return {
        agentName: this.agent.constructor.name,
        score: 0,
        moves: 0,
        completed: false,
        executionTimeMs: Date.now() - startTime,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        estimatedCost: 0,
      };
    } finally {
      // Close readline interface if it was created
      if (this.rl) {
        this.rl.close();
        this.rl = null;
      }
    }
  }

  /**
   * Run the agent in autonomous mode
   */
  private async runAutonomous(): Promise<void> {
    let iterations = 0;
    const maxIterations = this.options.maxIterations;

    while (iterations < maxIterations) {
      iterations++;
      this.logger.info(`Iteration ${iterations}/${maxIterations}`);

      // Get the current game state
      const gameState = this.agent.getGameState();

      // Check if the game has ended
      if (!gameState.gameStarted) {
        this.logger.info("Game has ended");
        break;
      }

      // Let the agent decide what to do next
      this.logger.info("Agent is thinking...");
      const response = await this.agent.processMessage(
        "What should I do next?"
      );
      this.logger.info(`Agent response: ${response}`);

      // Check if we've reached the maximum number of iterations
      if (iterations >= maxIterations) {
        this.logger.info(`Reached maximum iterations (${maxIterations})`);
        break;
      }
    }
  }

  /**
   * Run the agent in interactive mode
   */
  private async runInteractive(): Promise<void> {
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Helper function to get user input
    const getUserInput = (): Promise<string> => {
      return new Promise((resolve) => {
        if (!this.rl) {
          resolve("");
          return;
        }
        this.rl.question("> ", (answer) => {
          resolve(answer);
        });
      });
    };

    console.log("\n=== Interactive Agent Mode ===");
    console.log("Type 'exit' or 'quit' to end the session");
    console.log("Type 'auto' to switch to autonomous mode");
    console.log("Type 'help' to see available commands");
    console.log("Otherwise, your input will be sent to the agent\n");

    let running = true;
    while (running) {
      const input = await getUserInput();

      // Handle special commands
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log("Exiting interactive mode");
        running = false;
        continue;
      }

      if (input.toLowerCase() === "help") {
        console.log("\n=== Available Commands ===");
        console.log("exit, quit - End the session");
        console.log("auto - Switch to autonomous mode");
        console.log("help - Show this help message");
        console.log("stats - Show current game statistics");
        console.log("Any other input will be sent to the agent\n");
        continue;
      }

      if (input.toLowerCase() === "auto") {
        console.log("Switching to autonomous mode...");
        await this.runAutonomous();
        console.log("Autonomous mode completed, returning to interactive mode");
        continue;
      }

      if (input.toLowerCase() === "stats") {
        const gameState = this.agent.getGameState();
        const usage = this.agent.getTotalTokenUsage();
        const cost = this.agent.calculateTotalCost();

        console.log("\n=== Game Statistics ===");
        console.log(`Score: ${gameState.score}`);
        console.log(`Moves: ${gameState.moves}`);
        console.log(`Total Tokens: ${usage.totalTokens.toLocaleString()}`);
        console.log(`Estimated Cost: $${cost.toFixed(6)}\n`);
        continue;
      }

      // Process the user input with the agent
      try {
        const response = await this.agent.processMessage(input);
        console.log(`\nAgent: ${response}\n`);
      } catch (error) {
        console.error(`Error: ${error}`);
      }
    }
  }
}
