import { generateObject, generateText, LanguageModelV1 } from "ai";
import { Dialogue } from "../models/dialogue.js";
import { z } from "zod";
import { BaseWorkflow, BaseWorkflowConfig } from "./base.js";
import { openai } from "@ai-sdk/openai";
import { genericSolverSystemPrompt } from "../prompts/generic-solver.js";

/**
 * A workflow that adds reflection to the decision-making process
 */
export class ReflectionWorkflow extends BaseWorkflow {
  readonly name = "Reflection Workflow";
  private reflectionModel: LanguageModelV1;
  private commandModel: LanguageModelV1;

  constructor({
    reflectionModel,
    commandModel,
    ...config
  }: BaseWorkflowConfig & {
    reflectionModel: LanguageModelV1;
    commandModel: LanguageModelV1;
  }) {
    super(config);
    this.reflectionModel = reflectionModel;
    this.commandModel = commandModel;
  }

  get displayName(): string {
    return `${this.name} (${this.reflectionModel.modelId} -> ${this.commandModel.modelId})`;
  }

  getLogPrefix(): string {
    return `reflection_${this.reflectionModel.modelId}_${this.commandModel.modelId}`;
  }

  /**
   * Generates the next command based on the current dialogue
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command to send
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    // First reflect on the current state
    const reflection = await this.reflect(dialogue);
    this.logger?.info("Reflection:\n" + reflection);

    // Then generate the next command based on this reflection
    return await this.generateCommand(dialogue);
  }

  /**
   * Generates a command based on the dialogue history
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the next command
   */
  private async generateCommand(dialogue: Dialogue): Promise<string> {
    const result = await generateText({
      model: this.commandModel,
      messages: [
        ...dialogue.messages.slice(-10),
        {
          role: "user",
          content: `Based on the context, pick ONE command to execute (like 'inventory', 'look', 'go north', etc.).
            Return the command exactly as if you were typing it into the game. Return ONLY the command.
            Do not include quotes or punctuation.`,
        },
      ],
    });
    this.trackModelUsage(this.commandModel.modelId, result.usage);
    dialogue.assistant(result.text);
    return result.text;
  }

  /**
   * Reflects on the current game state to inform decision-making
   * @param dialogue The current dialogue history
   * @returns A promise resolving to the reflection text
   */
  private async reflect(dialogue: Dialogue): Promise<string> {
    const result = await generateText({
      model: this.reflectionModel,
      system: genericSolverSystemPrompt,
      messages: [
        ...dialogue.messages,
        {
          role: "user",
          content:
            "Reflect on the game progress so far using a chain-of-thought approach and decide what to try next. Be concise.",
        },
      ],
    });
    this.trackModelUsage(this.reflectionModel.modelId, result.usage);
    dialogue.assistant(result.text);
    return result.text;
  }
}
