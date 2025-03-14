import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "./base.js";
import { GameAgent } from "./game-agent.js";
import { MemoryAgent } from "./memory/memory-agent.js";
import { GoalAgent } from "./tools/goal-agent.js";
import { PuzzleSolverAgent } from "./tools/puzzle-solver.js";
import { MapAgent } from "./tools/map-agent.js";
import { LanguageModelV1 } from "ai";

/**
 * Configuration options for the AgentOrchestrator
 */
export interface AgentOrchestratorConfig extends BaseAgentConfig {
  /**
   * Path to the interactive fiction game file to run
   * @default "zork1.z3"
   */
  gamePath?: string;

  /**
   * Model to use for the memory agent
   */
  memoryModel?: LanguageModelV1;

  /**
   * Model to use for the goal agent
   */
  goalModel?: LanguageModelV1;

  /**
   * Model to use for the puzzle solver agent
   */
  puzzleModel?: LanguageModelV1;

  /**
   * Model to use for the map agent
   */
  mapModel?: LanguageModelV1;
}

/**
 * Orchestrator that coordinates multiple specialized agents
 */
export class AgentOrchestrator extends BaseAgent {
  private gameAgent: GameAgent;
  private memoryAgent: MemoryAgent;
  private goalAgent: GoalAgent;
  private puzzleSolverAgent: PuzzleSolverAgent;
  private mapAgent: MapAgent;

  constructor({
    gamePath = "zork1.z3",
    memoryModel,
    goalModel,
    puzzleModel,
    mapModel,
    ...config
  }: AgentOrchestratorConfig) {
    // Create the system prompt for the orchestrator
    const systemPrompt =
      config.systemPrompt ||
      `
You are an intelligent agent playing an interactive fiction game.
Your goal is to explore the game world, solve puzzles, and make progress in the story.

You have access to several specialized tools and agents:
- Game commands: Send commands to the game
- Memory: Store and retrieve important information
- Goals: Track objectives and progress
- Puzzles: Analyze and solve puzzles
- Map: Track locations and navigation

Think carefully about your actions and use your tools effectively to make progress in the game.
`;

    // Create the specialized agents first
    const gameAgent = new GameAgent({
      model: config.model,
      gamePath,
      displayName: "Game Agent",
      dialogueLimit: config.dialogueLimit,
    });

    const memoryAgent = new MemoryAgent({
      model: memoryModel || config.model,
      displayName: "Memory Agent",
      dialogueLimit: config.dialogueLimit,
    });

    const goalAgent = new GoalAgent({
      model: goalModel || config.model,
      displayName: "Goal Agent",
      dialogueLimit: config.dialogueLimit,
    });

    const puzzleSolverAgent = new PuzzleSolverAgent({
      model: puzzleModel || config.model,
      displayName: "Puzzle Solver Agent",
      dialogueLimit: config.dialogueLimit,
    });

    const mapAgent = new MapAgent({
      model: mapModel || config.model,
      displayName: "Map Agent",
      dialogueLimit: config.dialogueLimit,
    });

    // Create tools for interacting with the specialized agents
    // Game agent tools
    const sendGameCommandTool: Tool = {
      name: "send_game_command",
      description: "Send a command to the interactive fiction game",
      parameters: z.object({
        command: z.string().describe("The command to send to the game"),
      }),
      execute: async (params) => {
        return gameAgent.processMessage(params.command);
      },
    };

    // Memory agent tools
    const addMemoryTool: Tool = {
      name: "add_memory",
      description: "Add a new memory",
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
        const result = await memoryAgent.processMessage(
          `Please add a new memory with the following details:
Type: ${params.type}
Content: ${params.content}
Importance: ${params.importance}
${params.metadata ? `Metadata: ${JSON.stringify(params.metadata)}` : ""}`
        );
        return result;
      },
    };

    const retrieveMemoriesTool: Tool = {
      name: "retrieve_memories",
      description: "Retrieve memories based on type or content",
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
      }),
      execute: async (params) => {
        const result = await memoryAgent.processMessage(
          `Please retrieve memories with the following criteria:
${params.type ? `Type: ${params.type}` : ""}
${params.searchTerm ? `Search Term: ${params.searchTerm}` : ""}
${params.minImportance ? `Minimum Importance: ${params.minImportance}` : ""}`
        );
        return result;
      },
    };

    const summarizeMemoriesTool: Tool = {
      name: "summarize_memories",
      description: "Generate a summary of memories by type",
      parameters: z.object({
        type: z.string().optional().describe("Filter by memory type"),
      }),
      execute: async (params) => {
        const result = await memoryAgent.processMessage(
          `Please summarize memories${
            params.type ? ` of type "${params.type}"` : ""
          }.`
        );
        return result;
      },
    };

    // Goal agent tools
    const addGoalTool: Tool = {
      name: "add_goal",
      description: "Add a new goal or objective",
      parameters: z.object({
        description: z.string().describe("Description of the goal"),
        priority: z
          .number()
          .min(1)
          .max(10)
          .describe("Priority of the goal (1-10)"),
        parentId: z
          .string()
          .optional()
          .describe("ID of the parent goal, if this is a subgoal"),
      }),
      execute: async (params) => {
        const result = await goalAgent.processMessage(
          `Please add a new goal with the following details:
Description: ${params.description}
Priority: ${params.priority}
${params.parentId ? `Parent ID: ${params.parentId}` : ""}`
        );
        return result;
      },
    };

    const completeGoalTool: Tool = {
      name: "complete_goal",
      description: "Mark a goal as completed",
      parameters: z.object({
        id: z.string().describe("ID of the goal to complete"),
        notes: z.string().optional().describe("Notes about the completion"),
      }),
      execute: async (params) => {
        const result = await goalAgent.processMessage(
          `Please mark goal ${params.id} as completed${
            params.notes ? ` with notes: ${params.notes}` : ""
          }.`
        );
        return result;
      },
    };

    const getGoalsTool: Tool = {
      name: "get_goals",
      description: "Get goals filtered by status",
      parameters: z.object({
        status: z
          .enum(["active", "completed", "abandoned"])
          .optional()
          .describe("Filter by status"),
      }),
      execute: async (params) => {
        const result = await goalAgent.processMessage(
          `Please retrieve goals${
            params.status ? ` with status "${params.status}"` : ""
          }.`
        );
        return result;
      },
    };

    const analyzeGoalsTool: Tool = {
      name: "analyze_goals",
      description: "Analyze goals and provide insights",
      parameters: z.object({}),
      execute: async () => {
        const result = await goalAgent.processMessage(
          "Please analyze the current goals and provide strategic insights."
        );
        return result;
      },
    };

    // Puzzle solver tools
    const addPuzzleTool: Tool = {
      name: "add_puzzle",
      description: "Add a new puzzle to track",
      parameters: z.object({
        description: z.string().describe("Description of the puzzle"),
        initialClues: z
          .array(z.string())
          .optional()
          .describe("Initial clues for the puzzle"),
      }),
      execute: async (params) => {
        const result = await puzzleSolverAgent.processMessage(
          `Please add a new puzzle with the following details:
Description: ${params.description}
${
  params.initialClues
    ? `Initial Clues: ${JSON.stringify(params.initialClues)}`
    : ""
}`
        );
        return result;
      },
    };

    const addClueTool: Tool = {
      name: "add_clue",
      description: "Add a clue to an existing puzzle",
      parameters: z.object({
        puzzleId: z.string().describe("ID of the puzzle"),
        clue: z.string().describe("The clue to add"),
      }),
      execute: async (params) => {
        const result = await puzzleSolverAgent.processMessage(
          `Please add the following clue to puzzle ${params.puzzleId}:
${params.clue}`
        );
        return result;
      },
    };

    const analyzePuzzleTool: Tool = {
      name: "analyze_puzzle",
      description: "Analyze a puzzle and suggest possible solutions",
      parameters: z.object({
        puzzleId: z.string().describe("ID of the puzzle"),
      }),
      execute: async (params) => {
        const result = await puzzleSolverAgent.processMessage(
          `Please analyze puzzle ${params.puzzleId} and suggest possible solutions.`
        );
        return result;
      },
    };

    // Map agent tools
    const addLocationTool: Tool = {
      name: "add_location",
      description: "Add a new location to the map",
      parameters: z.object({
        name: z.string().describe("Name of the location"),
        description: z.string().describe("Description of the location"),
      }),
      execute: async (params) => {
        const result = await mapAgent.processMessage(
          `Please add a new location with the following details:
Name: ${params.name}
Description: ${params.description}`
        );
        return result;
      },
    };

    const addExitTool: Tool = {
      name: "add_exit",
      description: "Add an exit to a location",
      parameters: z.object({
        locationId: z.string().describe("ID of the location"),
        direction: z
          .string()
          .describe("Direction of the exit (e.g., north, south, east, west)"),
        destinationId: z
          .string()
          .optional()
          .describe("ID of the destination location, if known"),
      }),
      execute: async (params) => {
        const result = await mapAgent.processMessage(
          `Please add an exit from location ${params.locationId} in direction ${
            params.direction
          }${
            params.destinationId
              ? ` leading to location ${params.destinationId}`
              : ""
          }.`
        );
        return result;
      },
    };

    const generateMapTool: Tool = {
      name: "generate_map",
      description: "Generate a text representation of the map",
      parameters: z.object({}),
      execute: async () => {
        const result = await mapAgent.processMessage(
          "Please generate a text representation of the current map."
        );
        return result;
      },
    };

    // Create an array of all tools
    const tools = [
      // Game tools
      sendGameCommandTool,

      // Memory tools
      addMemoryTool,
      retrieveMemoriesTool,
      summarizeMemoriesTool,

      // Goal tools
      addGoalTool,
      completeGoalTool,
      getGoalsTool,
      analyzeGoalsTool,

      // Puzzle tools
      addPuzzleTool,
      addClueTool,
      analyzePuzzleTool,

      // Map tools
      addLocationTool,
      addExitTool,
      generateMapTool,
    ];

    // Initialize the base agent with the tools
    super({
      ...config,
      systemPrompt,
      tools,
    });

    // Store the agents as instance properties after super() call
    this.gameAgent = gameAgent;
    this.memoryAgent = memoryAgent;
    this.goalAgent = goalAgent;
    this.puzzleSolverAgent = puzzleSolverAgent;
    this.mapAgent = mapAgent;
  }

  /**
   * Execute a game command
   */
  private async executeGameCommand(command: string): Promise<string> {
    return this.gameAgent.processMessage(command);
  }

  /**
   * Start the game
   */
  public async startGame(): Promise<string> {
    // Start the game using the game agent
    const initialGameText = await this.gameAgent.startGame();

    // Process the initial game text with the orchestrator
    const response = await this.processMessage(initialGameText);

    return response;
  }

  /**
   * Get the current game state
   */
  public getGameState() {
    return this.gameAgent.getGameState();
  }

  /**
   * Calculate the total cost across all agents
   */
  public calculateTotalCost(customPricing?: Record<string, any>): number {
    let totalCost = 0;

    // Add costs from all agents
    totalCost += super.calculateTotalCost(customPricing);
    totalCost += this.gameAgent.calculateTotalCost(customPricing);
    totalCost += this.memoryAgent.calculateTotalCost(customPricing);
    totalCost += this.goalAgent.calculateTotalCost(customPricing);
    totalCost += this.puzzleSolverAgent.calculateTotalCost(customPricing);
    totalCost += this.mapAgent.calculateTotalCost(customPricing);

    return totalCost;
  }

  /**
   * Get the total token usage across all agents
   */
  public getTotalTokenUsage(): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    const baseUsage = super.getTotalUsage();
    const gameUsage = this.gameAgent.getTotalUsage();
    const memoryUsage = this.memoryAgent.getTotalUsage();
    const goalUsage = this.goalAgent.getTotalUsage();
    const puzzleUsage = this.puzzleSolverAgent.getTotalUsage();
    const mapUsage = this.mapAgent.getTotalUsage();

    return {
      promptTokens:
        baseUsage.promptTokens +
        gameUsage.promptTokens +
        memoryUsage.promptTokens +
        goalUsage.promptTokens +
        puzzleUsage.promptTokens +
        mapUsage.promptTokens,
      completionTokens:
        baseUsage.completionTokens +
        gameUsage.completionTokens +
        memoryUsage.completionTokens +
        goalUsage.completionTokens +
        puzzleUsage.completionTokens +
        mapUsage.completionTokens,
      totalTokens:
        baseUsage.totalTokens +
        gameUsage.totalTokens +
        memoryUsage.totalTokens +
        goalUsage.totalTokens +
        puzzleUsage.totalTokens +
        mapUsage.totalTokens,
    };
  }
}
