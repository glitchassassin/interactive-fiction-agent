import { APICallError, generateObject, LanguageModelV1 } from "ai";
import { Dialogue } from "../models/dialogue.js";
import { z } from "zod";
import { BaseWorkflow, BaseWorkflowConfig } from "./base.js";
import { genericSolverSystemPrompt } from "../prompts/generic-solver.js";

/**
 * A simple workflow that generates commands without any additional processing
 */
export class SimpleReasoningWorkflow extends BaseWorkflow {
  readonly name = "Simple Reasoning Workflow";
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

  get displayName(): string {
    return `${this.name} (${this.commandModel.modelId})`;
  }

  getLogPrefix(): string {
    return `simple_reasoning_${this.commandModel.modelId}`;
  }

  /**
   * Generates the next command based on the current dialogue
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    try {
      const result = await generateObject({
        model: this.commandModel,
        system: genericSolverSystemPrompt,
        schema: z.object({
          think: z.string().describe("The reasoning for the next command"),
          command: z
            .string()
            .describe(
              "The next command to execute (a simple verb noun combo, like 'go north' or 'take apple')"
            ),
        }),
        messages: dialogue.messages,
        experimental_repairText: async ({ text, error }) => {
          console.log(text, error);
          return null;
        },
      });
      dialogue.assistant(result.object);
      this.logger?.info(`think: ${result.object.think}`);
      this.trackModelUsage(this.commandModel.modelId, result.usage);
      return result.object.command;
    } catch (error) {
      if (APICallError.isInstance(error)) {
        console.log({ responseBody: error.responseBody });
        console.log(JSON.parse(error.responseBody!));
        console.log(
          JSON.parse(JSON.parse(error.responseBody!).message.content)
        );
      }
      throw error;
    }
  }
}
