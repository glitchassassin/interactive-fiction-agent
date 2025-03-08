import { generateObject, LanguageModelV1 } from "ai";
import { Dialogue } from "../models/dialogue.js";
import { z } from "zod";
import { BaseWorkflow, BaseWorkflowConfig } from "./base.js";
import { openai } from "@ai-sdk/openai";
import { genericSolverSystemPrompt } from "../prompts/generic-solver.js";

/**
 * A simple workflow that generates commands without any additional processing
 */
export class SimpleWorkflow extends BaseWorkflow {
  readonly name = "Simple Workflow";
  private commandModel: LanguageModelV1;

  constructor({
    commandModel,
    ...config
  }: BaseWorkflowConfig & {
    commandModel: LanguageModelV1;
  }) {
    super(config);
    this.commandModel = commandModel;
  }

  getLogPrefix(): string {
    return `simple_${this.commandModel.modelId}`;
  }

  /**
   * Generates the next command based on the current dialogue
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    const result = await generateObject({
      model: this.commandModel,
      system: genericSolverSystemPrompt,
      schema: z.object({
        command: z.string().describe("The next command to execute"),
      }),
      messages: dialogue.messages,
    });
    dialogue.assistant(result.object.command);
    return result.object.command;
  }
}
