import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "../base.js";
import { generateText } from "ai";

/**
 * Interface for a memory entry
 */
export interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  importance: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Configuration options for the MemoryAgent
 */
export interface MemoryAgentConfig extends BaseAgentConfig {
  /**
   * Maximum number of memories to store
   * @default 100
   */
  maxMemories?: number;
}

/**
 * Agent that manages memory for other agents
 */
export class MemoryAgent extends BaseAgent {
  private memories: MemoryEntry[] = [];
  private readonly maxMemories: number;
  private memoryCounter: number = 0;

  constructor({ maxMemories = 100, ...config }: MemoryAgentConfig) {
    // Create memory management tools
    const addMemoryTool: Tool = {
      name: "add_memory",
      description: "Add a new memory to the agent's memory store",
      parameters: z.object({
        type: z
          .string()
          .describe(
            "The type of memory (e.g., location, item, character, puzzle)"
          ),
        content: z.string().describe("The content of the memory"),
        importance: z
          .number()
          .min(1)
          .max(10)
          .describe("The importance of the memory (1-10)"),
        metadata: z
          .record(z.any())
          .optional()
          .describe("Additional metadata for the memory"),
      }),
      execute: async (params) => {
        return this.addMemory(
          params.type,
          params.content,
          params.importance,
          params.metadata
        );
      },
    };

    const retrieveMemoriesTool: Tool = {
      name: "retrieve_memories",
      description:
        "Retrieve memories based on type, content search, or importance",
      parameters: z.object({
        type: z.string().optional().describe("Filter by memory type"),
        searchTerm: z
          .string()
          .optional()
          .describe("Search term to find in memory content"),
        minImportance: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Minimum importance level"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of memories to retrieve"),
      }),
      execute: async (params) => {
        return this.retrieveMemories(
          params.type,
          params.searchTerm,
          params.minImportance,
          params.limit
        );
      },
    };

    const updateMemoryTool: Tool = {
      name: "update_memory",
      description: "Update an existing memory",
      parameters: z.object({
        id: z.string().describe("The ID of the memory to update"),
        content: z.string().optional().describe("New content for the memory"),
        importance: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("New importance level"),
        metadata: z.record(z.any()).optional().describe("Updated metadata"),
      }),
      execute: async (params) => {
        return this.updateMemory(
          params.id,
          params.content,
          params.importance,
          params.metadata
        );
      },
    };

    const summarizeMemoriesTool: Tool = {
      name: "summarize_memories",
      description: "Generate a summary of memories by type or importance",
      parameters: z.object({
        type: z.string().optional().describe("Filter by memory type"),
        minImportance: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Minimum importance level"),
      }),
      execute: async (params) => {
        return this.summarizeMemories(params.type, params.minImportance);
      },
    };

    // Create the system prompt for the memory agent
    const systemPrompt =
      config.systemPrompt ||
      `
You are a memory management agent that helps store and retrieve important information.
Your role is to:
1. Store new memories with appropriate importance levels
2. Retrieve relevant memories when needed
3. Update existing memories with new information
4. Summarize memories to provide context

Be concise and precise in your memory management.
`;

    // Call the base constructor with the tools
    super({
      ...config,
      tools: [
        addMemoryTool,
        retrieveMemoriesTool,
        updateMemoryTool,
        summarizeMemoriesTool,
        ...(config.tools || []),
      ],
      systemPrompt,
    });

    this.maxMemories = maxMemories;
  }

  /**
   * Add a new memory
   */
  private addMemory(
    type: string,
    content: string,
    importance: number,
    metadata?: Record<string, any>
  ): MemoryEntry {
    const id = `mem_${++this.memoryCounter}`;
    const timestamp = Date.now();

    const newMemory: MemoryEntry = {
      id,
      type,
      content,
      importance,
      timestamp,
      metadata,
    };

    this.memories.push(newMemory);
    this.logger.info(`Added memory: ${type} - ${content.substring(0, 50)}...`);

    // If we exceed the maximum number of memories, remove the least important ones
    if (this.memories.length > this.maxMemories) {
      this.memories.sort((a, b) => a.importance - b.importance);
      this.memories = this.memories.slice(
        this.memories.length - this.maxMemories
      );
    }

    return newMemory;
  }

  /**
   * Retrieve memories based on criteria
   */
  private retrieveMemories(
    type?: string,
    searchTerm?: string,
    minImportance?: number,
    limit?: number
  ): MemoryEntry[] {
    let results = [...this.memories];

    // Filter by type
    if (type) {
      results = results.filter((memory) => memory.type === type);
    }

    // Filter by search term
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      results = results.filter((memory) =>
        memory.content.toLowerCase().includes(searchTermLower)
      );
    }

    // Filter by minimum importance
    if (minImportance) {
      results = results.filter((memory) => memory.importance >= minImportance);
    }

    // Sort by importance (descending)
    results.sort((a, b) => b.importance - a.importance);

    // Apply limit
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Update an existing memory
   */
  private updateMemory(
    id: string,
    content?: string,
    importance?: number,
    metadata?: Record<string, any>
  ): MemoryEntry | null {
    const memoryIndex = this.memories.findIndex((memory) => memory.id === id);

    if (memoryIndex === -1) {
      this.logger.warn(`Memory with ID ${id} not found`);
      return null;
    }

    const memory = this.memories[memoryIndex];

    // Update fields if provided
    if (content !== undefined) {
      memory.content = content;
    }

    if (importance !== undefined) {
      memory.importance = importance;
    }

    if (metadata !== undefined) {
      memory.metadata = {
        ...(memory.metadata || {}),
        ...metadata,
      };
    }

    // Update timestamp
    memory.timestamp = Date.now();

    this.logger.info(`Updated memory: ${memory.id} - ${memory.type}`);

    return memory;
  }

  /**
   * Summarize memories by type or importance
   */
  private async summarizeMemories(
    type?: string,
    minImportance?: number
  ): Promise<string> {
    // Retrieve relevant memories
    const memories = this.retrieveMemories(type, undefined, minImportance);

    if (memories.length === 0) {
      return "No memories found matching the criteria.";
    }

    // Group memories by type
    const groupedMemories: Record<string, MemoryEntry[]> = {};

    for (const memory of memories) {
      if (!groupedMemories[memory.type]) {
        groupedMemories[memory.type] = [];
      }
      groupedMemories[memory.type].push(memory);
    }

    // Generate a summary using the LLM
    const summaryPrompt = `
Please summarize the following memories, organized by type:

${Object.entries(groupedMemories)
  .map(([type, memories]) => {
    return `## ${type.toUpperCase()}\n${memories
      .map((m) => `- ${m.content} (Importance: ${m.importance})`)
      .join("\n")}`;
  })
  .join("\n\n")}

Provide a concise summary that highlights the most important information.
`;

    this.dialogue.user(summaryPrompt);
    const summary = await this.generateSummary(summaryPrompt);
    return summary;
  }

  /**
   * Generate a summary using the model
   */
  private async generateSummary(message: string): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.dialogue.messages,
    });

    this.dialogue.assistant(result.text);
    this.trackModelUsage(this.model.modelId, result.usage);

    return result.text;
  }

  /**
   * Get all memories
   */
  public getAllMemories(): MemoryEntry[] {
    return [...this.memories];
  }
}
