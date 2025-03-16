import { Agent } from "./Agent.js";
import { MISTRAL } from "../models.js";
import { APICallError, CoreMessage, generateText, RetryError } from "ai";
import { genericSolverSystemPrompt } from "../prompts/generic-solver.js";

/**
 * A simple AI agent that can play interactive fiction games.
 * Uses the IF API to interact with the game and an AI model to generate commands.
 */
export class SimpleAIAgent extends Agent {
  private model: any;
  private gameName = "zork1.z3";
  private maxIterations = 100; // Maximum number of iterations to run
  private temperature: number | undefined; // Temperature for the model
  /**
   * Creates a new SimpleAIAgent.
   * @param model The AI model to use for generating commands (defaults to MISTRAL)
   * @param options Additional options for the agent
   */
  constructor(
    {
      model,
      options,
    }: {
      model?: any;
      options?: { maxIterations?: number; temperature?: number };
    } = {
      model: MISTRAL,
    }
  ) {
    super();
    this.model = model;
    if (options?.maxIterations) {
      this.maxIterations = options.maxIterations;
    }
    if (options?.temperature) {
      this.temperature = options.temperature;
    }
  }

  /**
   * The name of the agent.
   */
  get name(): string {
    return `simple|${this.model.modelId}`;
  }

  /**
   * Run the agent to play an interactive fiction game.
   */
  async run(): Promise<void> {
    try {
      // Create a game session using the base class method
      const { initialOutput, sendCommandTool } = await this.createGameSession(
        this.gameName
      );

      let messages: CoreMessage[] = [
        {
          role: "user",
          content: `You are playing an interactive fiction game. Here is the current game state:

${initialOutput}

Please continue playing the game by sending commands. Try to explore the world and make progress.`,
        },
      ];
      let iterationCount = 0;

      // Continue playing until the game is over or we reach the maximum number of iterations
      while (!this.gameOver && iterationCount < this.maxIterations) {
        iterationCount++;
        try {
          // Use multi-step tool calling to play the game
          const result = await generateText({
            model: this.model,
            tools: {
              sendCommand: sendCommandTool,
            },
            maxSteps: 5, // Allow up to 5 steps per iteration
            system: genericSolverSystemPrompt,
            messages: [
              ...messages,
              {
                role: "user",
                content:
                  "Continue playing the game by using the sendCommand tool. Try to explore the world and make progress.",
              },
            ],
            temperature: this.temperature,
          });

          messages.push(...(result.response?.messages ?? []));

          this.logger.info(`Text: ${result.text}`);
        } catch (error) {
          // extract the last error from the retry error
          if (error instanceof RetryError && error.lastError) {
            error = error.lastError;
          }

          // handle rate limit errors
          if (error instanceof APICallError) {
            if (!error.isRetryable) throw error;

            // check for rate limit
            if (error.statusCode === 429) {
              const retryAfter = parseInt(
                error.responseHeaders?.["retry-after"] ?? "15"
              );
              this.logger.info(
                `Rate limit exceeded. Waiting for ${retryAfter} seconds...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, retryAfter * 1000)
              );
              continue;
            }
          }
          throw error;
        }
      }
    } catch (error) {
      console.error("Error during game session:", error);
    }
  }
}
