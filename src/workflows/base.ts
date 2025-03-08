import { Dialogue } from "../models/dialogue.js";
import { sendCommand, startGame } from "../tools/ifapi.js";
import winston from "winston";

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
   * Logger instance for this workflow
   */
  protected readonly logger: winston.Logger;

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

    // Initialize logger
    this.logger = config.logger ?? createDefaultLogger();
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
    };
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
  }> {
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

      this.logger.info(`Game ended with score: ${score}, moves: ${moves}`);
      return { score, moves, gameEnded };
    } catch (error) {
      this.logger.error("Error during game execution:", error);
      return { score: 0, moves: 0, gameEnded: false };
    }
  }
}

/**
 * Creates a default logger that outputs to console
 * @returns A winston logger instance
 */
function createDefaultLogger(): winston.Logger {
  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });
}
