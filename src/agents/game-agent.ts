import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "./base.js";
import { sendCommand, startGame } from "../tools/ifapi.js";

/**
 * Configuration options for the GameAgent
 */
export interface GameAgentConfig extends BaseAgentConfig {
  /**
   * Path to the interactive fiction game file to run
   * @default "zork1.z3"
   */
  gamePath?: string;
}

/**
 * Agent that interacts with interactive fiction games
 */
export class GameAgent extends BaseAgent {
  private readonly gamePath: string;
  private sessionId: string = "";
  private gameStarted: boolean = false;
  private score: number = 0;
  private moves: number = 0;

  constructor({ gamePath = "zork1.z3", ...config }: GameAgentConfig) {
    // Create the game command tool
    const gameCommandTool: Tool = {
      name: "send_game_command",
      description: "Send a command to the interactive fiction game",
      parameters: z.object({
        command: z.string().describe("The command to send to the game"),
      }),
      execute: async (params) => {
        return this.executeGameCommand(params.command);
      },
    };

    // Add the game command tool to the tools list
    const tools = [...(config.tools || []), gameCommandTool];

    // Create the system prompt for the game agent
    const systemPrompt =
      config.systemPrompt ||
      `
You are an intelligent agent playing an interactive fiction game.
Your goal is to explore the game world, solve puzzles, and make progress in the story.

You can interact with the game by sending commands like:
- Movement: "north", "south", "east", "west", "up", "down"
- Actions: "take sword", "open door", "examine table"
- Inventory: "inventory" or "i"
- Look: "look" or "l"

Think carefully about your actions and remember important information about the game world.
`;

    // Call the base constructor with the updated config
    super({
      ...config,
      tools,
      systemPrompt,
    });

    this.gamePath = gamePath;
  }

  /**
   * Start the game
   */
  public async startGame(): Promise<string> {
    try {
      const result = await startGame(this.gamePath);
      this.sessionId = result.sessionId;
      this.gameStarted = true;

      // Add the initial game text to the dialogue
      this.dialogue.user(result.text);

      // Process the initial game text
      const response = await this.processMessage(result.text);

      return response;
    } catch (error) {
      const errorMessage = `Error starting game: ${error}`;
      this.logger.error(errorMessage);
      return errorMessage;
    }
  }

  /**
   * Execute a game command
   */
  private async executeGameCommand(command: string): Promise<string> {
    if (!this.gameStarted || !this.sessionId) {
      return "Game not started. Please start the game first.";
    }

    try {
      this.moves++;
      const result = await sendCommand(this.sessionId, command);

      // Extract score if available
      const scoreMatch = result.text.match(/Score: (\d+)/);
      if (scoreMatch && scoreMatch[1]) {
        this.score = parseInt(scoreMatch[1], 10);
      }

      return result.text;
    } catch (error) {
      return `Error executing command: ${error}`;
    }
  }

  /**
   * Get the current game state
   */
  public getGameState(): {
    score: number;
    moves: number;
    gameStarted: boolean;
  } {
    return {
      score: this.score,
      moves: this.moves,
      gameStarted: this.gameStarted,
    };
  }
}
