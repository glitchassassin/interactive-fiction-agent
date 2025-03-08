import { generateObject, generateText } from "ai";
import { Dialogue } from "../models/dialogue.js";
import { genericSolver } from "../agents/generic-solver.js";
import { z } from "zod";
import { BaseWorkflow } from "./base.js";

/**
 * A workflow that adds reflection to the decision-making process
 */
export class ReflectionWorkflow extends BaseWorkflow {
  readonly name = "Reflection Workflow";

  /**
   * Generates the next command based on the current dialogue
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    // First reflect on the current state
    const reflection = await this.reflect(dialogue);
    console.log("Reflection:", reflection);

    // Then generate the next command based on this reflection
    return await this.generateCommand(dialogue);
  }

  /**
   * Generates a command based on the dialogue history
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command
   */
  private async generateCommand(dialogue: Dialogue): Promise<string> {
    const result = await generateObject({
      ...genericSolver,
      system: undefined,
      schema: z.object({
        command: z.string().describe("The next command to execute"),
      }),
      messages: dialogue.messages,
    });
    dialogue.assistant(result.object.command);
    return result.object.command;
  }

  /**
   * Reflects on the current game state to inform decision-making
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the reflection text
   */
  private async reflect(dialogue: Dialogue): Promise<string> {
    const result = await generateText({
      ...genericSolver,
      messages: [
        ...dialogue.messages,
        {
          role: "user",
          content:
            "Reflect on the game progress so far using a chain-of-thought approach and decide what to try next. Be concise.",
        },
      ],
    });
    dialogue.assistant(result.text);
    return result.text;
  }
}
