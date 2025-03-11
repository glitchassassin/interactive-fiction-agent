import { Dialogue } from "../models/dialogue.js";
import { sendCommand, startGame } from "../tools/ifapi.js";
import winston from "winston";
import path from "path";
import fs from "fs";
import { ulid } from "ulid";

/**
 * Structure of API usage data
 */
export interface LanguageModelUsage {
  /**
   * The number of tokens used in the prompt
   */
  promptTokens: number;
  /**
   * The number of tokens used in the completion
   */
  completionTokens: number;
  /**
   * The total number of tokens used (promptTokens + completionTokens)
   */
  totalTokens: number;
}

/**
 * Model pricing information for cost estimation
 */
export interface ModelPricing {
  /** Cost per million prompt tokens in USD */
  promptCostPerMillion: number;
  /** Cost per million completion tokens in USD */
  completionCostPerMillion: number;
}

/**
 * Default pricing for common models (USD per million tokens)
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI models
  "gpt-4o": { promptCostPerMillion: 2.5, completionCostPerMillion: 10.0 },
  "gpt-4o-mini": { promptCostPerMillion: 0.15, completionCostPerMillion: 0.6 },
  "o3-mini": { promptCostPerMillion: 1.1, completionCostPerMillion: 4.4 },

  // Anthropic models
  "claude-3-5-haiku-20241022": {
    promptCostPerMillion: 0.8,
    completionCostPerMillion: 4.0,
  },
  "claude-3-7-sonnet-20250219": {
    promptCostPerMillion: 3.0,
    completionCostPerMillion: 15.0,
  },

  // Grok models
  "grok-2": { promptCostPerMillion: 2.0, completionCostPerMillion: 10.0 },

  // Default fallback pricing
  default: { promptCostPerMillion: 0, completionCostPerMillion: 0 },
};

/**
 * Configuration options for the BaseWorkflow
 */
export interface BaseWorkflowConfig {
  /**
   * Maximum number of iterations (commands) to run before ending the game
   * @default 100
   */
  maxIterations?: number;

  /**
   * Path to the interactive fiction game file to run
   * @default "zork1.z3"
   */
  gamePath?: string;

  /**
   * Maximum number of messages to store in the dialogue history
   * @default 50
   */
  dialogueLimit?: number;

  /**
   * Custom display name for the workflow instance
   * If not provided, one will be generated based on the class name and configuration
   */
  displayName?: string;

  /**
   * Custom logger instance
   * If not provided, a default console logger will be used
   */
  logger?: winston.Logger;

  /**
   * Path to the log file
   * If provided, logs will be written to this file
   */
  logPath?: string;
}

/**
 * Abstract base class for interactive fiction game workflows
 */
export abstract class BaseWorkflow {
  /**
   * The name of the workflow implementation
   */
  abstract readonly name: string;

  /**
   * Maximum number of iterations (commands) to run before ending the game
   */
  private readonly maxIterations: number;

  /**
   * Path to the interactive fiction game file to run
   */
  private readonly gamePath: string;

  /**
   * Maximum number of messages to store in the dialogue history
   */
  private readonly dialogueLimit: number;

  /**
   * Configuration parts for display name generation
   */
  private readonly configParts: string[];

  /**
   * Path to the log file for this workflow
   */
  protected logPath?: string;

  /**
   * Logger instance for this workflow
   */
  protected logger?: winston.Logger;

  /**
   * Tracks API usage per model
   */
  protected modelUsage: Map<string, LanguageModelUsage> = new Map();

  /**
   * Creates a new BaseWorkflow instance
   * @param config Configuration options for the workflow
   */
  constructor(config: BaseWorkflowConfig = {}) {
    this.maxIterations = config.maxIterations ?? 100;
    this.gamePath = config.gamePath ?? "zork1.z3";
    this.dialogueLimit = config.dialogueLimit ?? 50;

    // Store configuration parts for display name generation
    this.configParts = [];

    if (config.maxIterations && config.maxIterations !== 100) {
      this.configParts.push(`iterations=${config.maxIterations}`);
    }

    if (config.gamePath && config.gamePath !== "zork1.z3") {
      this.configParts.push(`game=${config.gamePath}`);
    }

    if (config.dialogueLimit && config.dialogueLimit !== 50) {
      this.configParts.push(`dialogueLimit=${config.dialogueLimit}`);
    }

    this.logPath = config.logPath;
  }

  getLogPrefix() {
    return `${this.constructor.name}`;
  }

  /**
   * The display name for this workflow instance, including configuration details
   */
  get displayName(): string {
    if (this.configParts.length > 0) {
      return `${this.name} (${this.configParts.join(", ")})`;
    }
    return this.name;
  }

  /**
   * Get the maximum number of iterations
   */
  get getMaxIterations(): number {
    return this.maxIterations;
  }

  /**
   * Get the game path
   */
  get getGamePath(): string {
    return this.gamePath;
  }

  /**
   * Get the dialogue limit
   */
  get getDialogueLimit(): number {
    return this.dialogueLimit;
  }

  /**
   * Get the current configuration as a BaseWorkflowConfig object
   */
  get config(): BaseWorkflowConfig {
    return {
      maxIterations: this.maxIterations,
      gamePath: this.gamePath,
      dialogueLimit: this.dialogueLimit,
      displayName: this.displayName,
    };
  }

  /**
   * Tracks API usage for a specific model
   * @param modelName The name of the model being used
   * @param usage The usage data from the API response
   */
  protected trackModelUsage(
    modelName: string,
    usage: LanguageModelUsage
  ): void {
    if (!this.modelUsage.has(modelName)) {
      this.modelUsage.set(modelName, {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    }

    const currentUsage = this.modelUsage.get(modelName)!;
    currentUsage.promptTokens += usage.promptTokens;
    currentUsage.completionTokens += usage.completionTokens;
    currentUsage.totalTokens += usage.totalTokens;
  }

  /**
   * Gets the current usage statistics for all models
   * @returns A map of model names to their usage statistics
   */
  public getModelUsage(): Map<string, LanguageModelUsage> {
    return new Map(this.modelUsage);
  }

  /**
   * Gets the total usage across all models
   * @returns The combined usage statistics
   */
  public getTotalUsage(): LanguageModelUsage {
    const totalUsage: LanguageModelUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (const usage of this.modelUsage.values()) {
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
    }

    return totalUsage;
  }

  /**
   * Implement this method to define the game's decision-making logic
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected abstract gameLoop(dialogue: Dialogue): Promise<string>;

  /**
   * Runs the interactive fiction game with the implemented game loop
   * @returns A promise resolving to the final score and moves count
   */
  public async run(): Promise<{
    score: number;
    moves: number;
    gameEnded: boolean;
    usage: LanguageModelUsage;
  }> {
    // Initialize logger
    this.logPath ??= `./logs/${this.getLogPrefix()}_${ulid()}.log`;
    this.logger ??= createDefaultLogger(this.logPath);

    try {
      this.logger.info(`Starting game: ${this.gamePath}`);
      const initialGameState = await startGame(this.gamePath);
      const sessionId = initialGameState.sessionId;
      await sendCommand(sessionId, "verbose");
      let text = initialGameState.text;

      // Create a dialogue instance with the configured message limit
      const dialogue = new Dialogue(this.dialogueLimit);
      dialogue.user(text);
      this.logger.info(text);

      // Initialize score and moves
      let score = 0;
      let moves = 0;
      let gameEnded = false;

      for (let i = 0; i < this.maxIterations; i++) {
        // Parse score and moves if available
        const scoreMatch = text.match(/Score:\s*(\d+)/i);
        const movesMatch = text.match(/Moves:\s*(\d+)/i);

        if (scoreMatch) {
          score = parseInt(scoreMatch[1], 10);
        }

        if (movesMatch) {
          moves = parseInt(movesMatch[1], 10);
        }

        // generate next command based on the current game state
        const command = await this.gameLoop(dialogue);
        this.logger.info(`> ${command}`);

        // send command and get response
        ({ text } = await sendCommand(sessionId, command));
        dialogue.user(text);
        this.logger.info(`${text}\n`);

        // check if game ended
        const gameEndPatterns = [
          /you have died/i,
          /game over/i,
          /the end/i,
          /you have won/i,
          /thanks for playing/i,
        ];

        if (gameEndPatterns.some((pattern) => pattern.test(text))) {
          this.logger.info("Game ended");
          gameEnded = true;
          break;
        }
      }

      // Final check for score in case it was updated in the last response
      const finalScoreMatch = text.match(/Score:\s*(\d+)/i);
      const finalMovesMatch = text.match(/Moves:\s*(\d+)/i);

      if (finalScoreMatch) {
        score = parseInt(finalScoreMatch[1], 10);
      }

      if (finalMovesMatch) {
        moves = parseInt(finalMovesMatch[1], 10);
      }

      const totalUsage = this.getTotalUsage();
      this.logger.info(
        `Game ended with score: ${score}, moves: ${moves}, total tokens: ${totalUsage.totalTokens}`
      );
      return { score, moves, gameEnded, usage: totalUsage };
    } catch (error) {
      this.logger.error("Error during game execution:", error);
      return {
        score: 0,
        moves: 0,
        gameEnded: false,
        usage: this.getTotalUsage(),
      };
    }
  }

  /**
   * Calculates the estimated cost of token usage for a specific model
   * @param modelName The name of the model
   * @param usage The usage data
   * @param customPricing Optional custom pricing information
   * @returns The estimated cost in USD
   */
  public calculateCost(
    modelName: string,
    usage: LanguageModelUsage,
    customPricing?: ModelPricing
  ): number {
    // Get pricing information for the model
    const pricing =
      customPricing ||
      DEFAULT_MODEL_PRICING[modelName] ||
      DEFAULT_MODEL_PRICING["default"];

    // Calculate cost
    const promptCost =
      (usage.promptTokens / 1_000_000) * pricing.promptCostPerMillion;
    const completionCost =
      (usage.completionTokens / 1_000_000) * pricing.completionCostPerMillion;

    return promptCost + completionCost;
  }

  /**
   * Calculates the total cost across all models
   * @param customPricing Optional map of custom pricing information by model name
   * @returns The total estimated cost in USD
   */
  public calculateTotalCost(
    customPricing?: Record<string, ModelPricing>
  ): number {
    let totalCost = 0;

    for (const [modelName, usage] of this.modelUsage.entries()) {
      const modelPricing = customPricing?.[modelName];
      totalCost += this.calculateCost(modelName, usage, modelPricing);
    }

    return totalCost;
  }
}

/**
 * Creates a default logger that outputs to console and optionally to a file
 * @param logPath Optional path to log file
 * @returns A winston logger instance
 */
function createDefaultLogger(logPath: string): winston.Logger {
  // Ensure the directory exists
  const logDir = path.dirname(logPath);
  fs.mkdirSync(logDir, { recursive: true });

  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
    transports: [
      new winston.transports.File({
        filename: logPath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
          })
        ),
      }),
    ],
  });
}
