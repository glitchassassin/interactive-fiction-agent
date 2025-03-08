import { Dialogue } from "../models/dialogue.js";
import { sendCommand, startGame } from "../tools/ifapi.js";

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
   * Creates a new BaseWorkflow instance
   * @param config Configuration options for the workflow
   */
  constructor(config: BaseWorkflowConfig = {}) {
    this.maxIterations = config.maxIterations ?? 100;
    this.gamePath = config.gamePath ?? "zork1.z3";
    this.dialogueLimit = config.dialogueLimit ?? 50;
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
  public async run(): Promise<{ score: number; moves: number }> {
    try {
      const initialGameState = await startGame(this.gamePath);
      const sessionId = initialGameState.sessionId;
      await sendCommand(sessionId, "verbose");
      let text = initialGameState.text;

      // Create a dialogue instance with the configured message limit
      const dialogue = new Dialogue(this.dialogueLimit);
      dialogue.user(text);
      console.log(text);

      // Initialize score and moves
      let score = 0;
      let moves = 0;

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
        console.log(">", command);

        // send command and get response
        ({ text } = await sendCommand(sessionId, command));
        dialogue.user(text);
        console.log(text + "\n");

        // check if game ended
        const gameEndPatterns = [
          /you have died/i,
          /game over/i,
          /the end/i,
          /you have won/i,
          /thanks for playing/i,
        ];

        if (gameEndPatterns.some((pattern) => pattern.test(text))) {
          console.log("Game ended");
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

      console.log(`Game ended with score: ${score}, moves: ${moves}`);
      return { score, moves };
    } catch (error) {
      console.error("Error during initialization:", error);
      return { score: 0, moves: 0 };
    }
  }
}
