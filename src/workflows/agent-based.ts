import { BaseWorkflow, BaseWorkflowConfig } from "./base.js";
import { Dialogue } from "../models/dialogue.js";
import { AgentOrchestrator } from "../agents/agent-orchestrator.js";
import { LanguageModelV1 } from "ai";

/**
 * Configuration options for the AgentBasedWorkflow
 */
export interface AgentBasedWorkflowConfig extends BaseWorkflowConfig {
  /**
   * The main language model to use for the orchestrator
   */
  mainModel: LanguageModelV1;

  /**
   * Optional model to use for the memory agent
   */
  memoryModel?: LanguageModelV1;

  /**
   * Optional model to use for the goal agent
   */
  goalModel?: LanguageModelV1;

  /**
   * Optional model to use for the puzzle solver agent
   */
  puzzleModel?: LanguageModelV1;

  /**
   * Optional model to use for the map agent
   */
  mapModel?: LanguageModelV1;
}

/**
 * A workflow that uses an agent-based approach with specialized agents
 */
export class AgentBasedWorkflow extends BaseWorkflow {
  readonly name = "Agent-Based Workflow";
  private readonly orchestrator: AgentOrchestrator;
  private readonly mainModel: LanguageModelV1;
  private readonly memoryModel?: LanguageModelV1;
  private readonly goalModel?: LanguageModelV1;
  private readonly puzzleModel?: LanguageModelV1;
  private readonly mapModel?: LanguageModelV1;

  constructor({
    mainModel,
    memoryModel,
    goalModel,
    puzzleModel,
    mapModel,
    ...config
  }: AgentBasedWorkflowConfig) {
    super(config);

    this.mainModel = mainModel;
    this.memoryModel = memoryModel;
    this.goalModel = goalModel;
    this.puzzleModel = puzzleModel;
    this.mapModel = mapModel;

    // Create the agent orchestrator
    this.orchestrator = new AgentOrchestrator({
      model: mainModel,
      gamePath: this.getGamePath,
      dialogueLimit: this.getDialogueLimit,
      memoryModel,
      goalModel,
      puzzleModel,
      mapModel,
    });
  }

  get displayName(): string {
    let name = `${this.name} (${this.mainModel.modelId})`;

    if (this.memoryModel) {
      name += ` + Memory(${this.memoryModel.modelId})`;
    }

    if (this.goalModel) {
      name += ` + Goals(${this.goalModel.modelId})`;
    }

    if (this.puzzleModel) {
      name += ` + Puzzles(${this.puzzleModel.modelId})`;
    }

    if (this.mapModel) {
      name += ` + Map(${this.mapModel.modelId})`;
    }

    return name;
  }

  getLogPrefix(): string {
    return `agent_based_${this.mainModel.modelId}`;
  }

  /**
   * Process the game dialogue using the agent orchestrator
   */
  protected async gameLoop(dialogue: Dialogue): Promise<string> {
    // Get the last user message
    const lastMessage = dialogue.messages[dialogue.messages.length - 1];

    if (lastMessage.role !== "user") {
      throw new Error("Expected last message to be from user");
    }

    // Process the message with the orchestrator
    // Handle different content types
    const messageContent =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const response = await this.orchestrator.processMessage(messageContent);

    // Add the response to the dialogue
    dialogue.assistant(response);

    // Extract the command from the response
    // The orchestrator might provide analysis and then a command
    // We need to extract just the command to send to the game
    const commandMatch = response.match(
      /^(?:.*\n)*?(?:>|I will|Let me|I'll|I should)?\s*([a-z].*?)(?:\.|$)/im
    );
    const command = commandMatch ? commandMatch[1].trim() : response.trim();

    // Track token usage from the orchestrator
    const usage = this.orchestrator.getTotalTokenUsage();
    this.trackModelUsage(this.mainModel.modelId, {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });

    // Return the command to be sent to the game
    return command;
  }

  /**
   * Calculate the total cost of the workflow
   */
  public calculateTotalCost(customPricing?: Record<string, any>): number {
    // Use the orchestrator's cost calculation
    return this.orchestrator.calculateTotalCost(customPricing);
  }
}
