import { LanguageModelV1, generateObject, generateText } from "ai";
import { z } from "zod";
import { Dialogue } from "../models/dialogue.js";
import winston from "winston";
import { ulid } from "ulid";
import {
  LanguageModelUsage,
  ModelPricing,
  DEFAULT_MODEL_PRICING,
} from "../workflows/base.js";

/**
 * Interface for tool definitions
 */
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (params: any) => Promise<any>;
}

/**
 * Configuration options for the BaseAgent
 */
export interface BaseAgentConfig {
  /**
   * The language model to use for the agent
   */
  model: LanguageModelV1;

  /**
   * Maximum number of messages to store in the dialogue history
   * @default 50
   */
  dialogueLimit?: number;

  /**
   * Custom display name for the agent instance
   */
  displayName?: string;

  /**
   * Custom logger instance
   */
  logger?: winston.Logger;

  /**
   * Path to the log file
   */
  logPath?: string;

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Available tools for the agent to use
   */
  tools?: Tool[];
}

/**
 * Base class for all agents
 */
export class BaseAgent {
  protected readonly model: LanguageModelV1;
  protected readonly dialogueLimit: number;
  protected readonly displayName: string;
  protected readonly logger: winston.Logger;
  protected readonly systemPrompt: string;
  protected readonly tools: Tool[];
  protected readonly id: string;
  protected modelUsage: Map<string, LanguageModelUsage> = new Map();
  protected dialogue: Dialogue;

  constructor({
    model,
    dialogueLimit = 50,
    displayName,
    logger,
    logPath,
    systemPrompt = "You are a helpful assistant.",
    tools = [],
  }: BaseAgentConfig) {
    this.model = model;
    this.dialogueLimit = dialogueLimit;
    this.displayName = displayName || `Agent (${model.modelId})`;
    this.id = ulid();
    this.systemPrompt = systemPrompt;
    this.tools = tools;

    // Create logger if not provided
    this.logger = logger || createDefaultLogger(this.displayName, logPath);

    // Initialize dialogue with system prompt
    this.dialogue = new Dialogue(dialogueLimit);
    this.dialogue.system(this.systemPrompt);
  }

  /**
   * Track model usage for cost calculation
   */
  protected trackModelUsage(
    modelName: string,
    usage: LanguageModelUsage
  ): void {
    const existingUsage = this.modelUsage.get(modelName);
    if (existingUsage) {
      existingUsage.promptTokens += usage.promptTokens;
      existingUsage.completionTokens += usage.completionTokens;
      existingUsage.totalTokens += usage.totalTokens;
    } else {
      this.modelUsage.set(modelName, { ...usage });
    }
  }

  /**
   * Get the total usage across all models
   */
  public getTotalUsage(): LanguageModelUsage {
    const totalUsage: LanguageModelUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (const usage of this.modelUsage.values()) {
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
    }

    return totalUsage;
  }

  /**
   * Calculate the cost of model usage
   */
  public calculateCost(
    modelName: string,
    usage: LanguageModelUsage,
    customPricing?: ModelPricing
  ): number {
    const pricing =
      customPricing ||
      DEFAULT_MODEL_PRICING[modelName] ||
      DEFAULT_MODEL_PRICING.default;

    const promptCost =
      (usage.promptTokens / 1_000_000) * pricing.promptCostPerMillion;
    const completionCost =
      (usage.completionTokens / 1_000_000) * pricing.completionCostPerMillion;

    return promptCost + completionCost;
  }

  /**
   * Calculate the total cost across all models
   */
  public calculateTotalCost(
    customPricing?: Record<string, ModelPricing>
  ): number {
    let totalCost = 0;

    for (const [modelName, usage] of this.modelUsage.entries()) {
      const modelPricing = customPricing?.[modelName];
      totalCost += this.calculateCost(modelName, usage, modelPricing);
    }

    return totalCost;
  }

  /**
   * Process a user message and generate a response
   */
  public async processMessage(message: string): Promise<string> {
    this.dialogue.user(message);

    // If there are tools, use generateObject with function calling
    if (this.tools.length > 0) {
      return this.processWithTools(message);
    }

    // Otherwise, use simple text generation
    return this.processWithoutTools(message);
  }

  /**
   * Process a message without using tools
   */
  private async processWithoutTools(message: string): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.dialogue.messages,
    });

    this.dialogue.assistant(result.text);
    this.trackModelUsage(this.model.modelId, result.usage);

    return result.text;
  }

  /**
   * Process a message with tool calling capabilities
   */
  private async processWithTools(message: string): Promise<string> {
    // Create a schema for tool calling
    const toolSchemas: Record<string, z.ZodObject<any>> = {};

    for (const tool of this.tools) {
      toolSchemas[tool.name] = tool.parameters;
    }

    // Generate a response with potential tool calls
    const result = await generateObject({
      model: this.model,
      messages: this.dialogue.messages,
      schema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("respond"),
          response: z.string().describe("A direct response to the user"),
        }),
        ...this.tools.map((tool) =>
          z.object({
            action: z.literal(tool.name),
            parameters: tool.parameters,
          })
        ),
      ]),
    });

    this.trackModelUsage(this.model.modelId, result.usage);

    // Handle the response based on the action
    const response = result.object;

    if (response.action === "respond") {
      // Direct response to the user
      const responseObj = response as { action: "respond"; response: string };
      this.dialogue.assistant(responseObj.response);
      return responseObj.response;
    } else {
      // Tool call
      const tool = this.tools.find((t) => t.name === response.action);

      if (!tool) {
        const errorMessage = `Tool ${response.action} not found`;
        this.logger.error(errorMessage);
        this.dialogue.assistant(errorMessage);
        return errorMessage;
      }

      try {
        // Execute the tool
        const toolCallObj = response as { action: string; parameters: any };
        const toolResult = await tool.execute(toolCallObj.parameters);

        // Add the tool result to the dialogue
        this.dialogue.tool(this.id, tool.name, toolResult);

        // Process the tool result to generate a response
        return this.processToolResult(tool.name, toolResult);
      } catch (error) {
        const errorMessage = `Error executing tool ${tool.name}: ${error}`;
        this.logger.error(errorMessage);
        this.dialogue.assistant(errorMessage);
        return errorMessage;
      }
    }
  }

  /**
   * Process the result of a tool call to generate a response
   */
  private async processToolResult(
    toolName: string,
    toolResult: any
  ): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.dialogue.messages,
    });

    this.dialogue.assistant(result.text);
    this.trackModelUsage(this.model.modelId, result.usage);

    return result.text;
  }
}

/**
 * Create a default logger for the agent
 */
function createDefaultLogger(
  agentName: string,
  logPath?: string
): winston.Logger {
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [${agentName}] ${level}: ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message }) => {
            return `[${agentName}] ${level}: ${message}`;
          })
        ),
      }),
    ],
  });

  // Add file transport if logPath is provided
  if (logPath) {
    logger.add(
      new winston.transports.File({
        filename: logPath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  return logger;
}
