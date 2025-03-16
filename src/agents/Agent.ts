/**
 * Abstract base class for all agents.
 * All agent implementations must extend this class and implement the abstract methods.
 */
import { startGame, sendCommand } from "../tools/ifapi.js";
import { tool } from "ai";
import { z } from "zod";
import winston from "winston";
import fs from "fs";
import path from "path";

export abstract class Agent {
  /**
   * The name of the agent. Must be implemented by subclasses.
   */
  abstract get name(): string;

  /**
   * The current score of the agent.
   */
  public score: number = 0;

  /**
   * The number of moves the agent has made.
   */
  public moves: number = 0;

  /**
   * Whether the game is over.
   */
  public gameOver: boolean = false;

  /**
   * Private logger instance.
   */
  private _logger?: winston.Logger;

  /**
   * Get the logger for this agent.
   * Initializes the logger with the agent's name if it hasn't been initialized yet.
   */
  protected get logger(): winston.Logger {
    if (!this._logger) {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Sanitize the agent name for use in the filename
      const sanitizedName = this.name.replace(/[^a-zA-Z0-9]/g, "_");
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const logFilename = `${sanitizedName}_${timestamp}.log`;
      const logPath = path.join(process.cwd(), "logs", logFilename);

      // Create the logger with console and file transports
      this._logger = winston.createLogger({
        level: "info",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
          })
        ),
        transports: [
          new winston.transports.File({
            filename: logPath,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.printf(({ level, message, timestamp }) => {
                return `${timestamp} ${level}: ${message}`;
              })
            ),
          }),
        ],
      });

      this._logger.info(
        `Agent ${this.name} initialized. Logging to ${logPath}`
      );
    }

    return this._logger;
  }

  /**
   * Run the agent. Must be implemented by subclasses.
   * @returns A promise that resolves when the agent has completed its run.
   */
  abstract run(): Promise<void>;

  /**
   * Creates a game session and returns the initial game output and a sendCommand tool.
   * @param gameName The name of the game to start
   * @returns An object containing the initial game output and a sendCommand tool
   */
  protected async createGameSession(gameName: string): Promise<{
    initialOutput: string;
    sessionId: string;
    sendCommandTool: any; // Using 'any' to avoid complex typing issues
  }> {
    // Start the game and get the initial output and session ID
    this.logger.info(`Starting game: ${gameName}`);
    const gameStart = await startGame(gameName);
    const sessionId = gameStart.sessionId;
    const initialOutput = gameStart.text;

    if (!sessionId) {
      const errorMsg = `Failed to start game "${gameName}"`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.logger.info(`Game started with session ID: ${sessionId}`);
    this.logger.info(`Initial output: ${initialOutput}`);

    // Enable verbose output
    await sendCommand(sessionId, "verbose");
    this.logger.info("Enabled verbose mode");

    // Parse initial score and moves from the game output
    const initialScoreMatch = initialOutput.match(/Score:\s*(\d+)/);
    const initialMovesMatch = initialOutput.match(/Moves:\s*(\d+)/);

    // Set initial score and moves if found in the output
    if (initialScoreMatch && initialScoreMatch[1]) {
      this.score = parseInt(initialScoreMatch[1]);
    }

    if (initialMovesMatch && initialMovesMatch[1]) {
      this.moves = parseInt(initialMovesMatch[1]);
    }

    this.logger.info(`Initial score: ${this.score}, Moves: ${this.moves}`);

    // Define the sendCommand tool
    const sendCommandTool = tool({
      description: "Send a command to the interactive fiction game",
      parameters: z.object({
        command: z.string().describe("The command to send to the game"),
      }),
      execute: async ({ command }) => {
        // Log the command
        this.logger.info(`Command: ${command}`);

        // Send the command to the game
        const response = await sendCommand(sessionId, command);
        const gameOutput = response.text;

        // Log the response
        this.logger.info(`Response: ${gameOutput}`);

        // Parse score and moves from the game output
        const scoreMatch = gameOutput.match(/Score:\s*(\d+)/);
        const movesMatch = gameOutput.match(/Moves:\s*(\d+)/);

        // Update score and moves if found in the output
        if (scoreMatch && scoreMatch[1]) {
          this.score = parseInt(scoreMatch[1]);
        }

        if (movesMatch && movesMatch[1]) {
          this.moves = parseInt(movesMatch[1]);
        } else {
          // If moves not found in output, increment manually
          this.moves++;
        }

        // Check if the game is over
        const gameOverIndicators = [
          /would you like to restart/i,
          /game over/i,
          /you have died/i,
          /you are dead/i,
          /your score is \d+ of a possible/i,
          /in that game you scored/i,
          /thanks for playing/i,
          /the end/i,
        ];

        this.gameOver ||= gameOverIndicators.some((indicator) =>
          indicator.test(gameOutput)
        );

        if (this.gameOver) {
          this.logger.info("Game over detected!");
          console.log("Game over detected!");
        }

        return {
          output: gameOutput,
          command,
          score: this.score,
          moves: this.moves,
          gameOver: this.gameOver,
        };
      },
    });

    return {
      initialOutput,
      sessionId,
      sendCommandTool,
    };
  }
}
