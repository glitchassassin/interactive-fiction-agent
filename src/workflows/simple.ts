import { generateObject } from "ai";
import { Dialogue } from "../models/dialogue.js";
import { genericSolver } from "../agents/generic-solver.js";
import { z } from "zod";
import { BaseWorkflow } from "./base.js";

/**
 * A simple workflow that generates commands without any additional processing
 */
export class SimpleWorkflow extends BaseWorkflow {
  readonly name = "Simple Workflow";

  /**
   * Generates the next command based on the current dialogue
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
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
}
