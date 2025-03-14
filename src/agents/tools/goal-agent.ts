import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "../base.js";
import { generateText } from "ai";

/**
 * Interface for a goal
 */
export interface Goal {
  id: string;
  description: string;
  status: "active" | "completed" | "abandoned";
  priority: number;
  parentId?: string;
  subgoals: string[];
  createdAt: number;
  completedAt?: number;
  notes: string[];
}

/**
 * Configuration options for the GoalAgent
 */
export interface GoalAgentConfig extends BaseAgentConfig {
  /**
   * Initial goals to set
   */
  initialGoals?: Omit<
    Goal,
    "id" | "status" | "subgoals" | "createdAt" | "notes"
  >[];
}

/**
 * Agent that manages goals and objectives
 */
export class GoalAgent extends BaseAgent {
  private goals: Map<string, Goal> = new Map();
  private goalCounter: number = 0;

  constructor(config: GoalAgentConfig) {
    // Create goal management tools
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
        return this.addGoal(
          params.description,
          params.priority,
          params.parentId
        );
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
        return this.updateGoalStatus(params.id, "completed", params.notes);
      },
    };

    const abandonGoalTool: Tool = {
      name: "abandon_goal",
      description: "Mark a goal as abandoned",
      parameters: z.object({
        id: z.string().describe("ID of the goal to abandon"),
        notes: z.string().optional().describe("Reason for abandonment"),
      }),
      execute: async (params) => {
        return this.updateGoalStatus(params.id, "abandoned", params.notes);
      },
    };

    const addNoteToGoalTool: Tool = {
      name: "add_note_to_goal",
      description: "Add a note to an existing goal",
      parameters: z.object({
        id: z.string().describe("ID of the goal"),
        note: z.string().describe("Note to add to the goal"),
      }),
      execute: async (params) => {
        return this.addNoteToGoal(params.id, params.note);
      },
    };

    const getGoalsTool: Tool = {
      name: "get_goals",
      description: "Get goals filtered by status and/or priority",
      parameters: z.object({
        status: z
          .enum(["active", "completed", "abandoned"])
          .optional()
          .describe("Filter by status"),
        minPriority: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Minimum priority"),
        parentId: z
          .string()
          .optional()
          .describe("Get subgoals of a specific parent"),
      }),
      execute: async (params) => {
        return this.getGoals(
          params.status,
          params.minPriority,
          params.parentId
        );
      },
    };

    const analyzeGoalsTool: Tool = {
      name: "analyze_goals",
      description: "Analyze goals and provide insights",
      parameters: z.object({
        status: z
          .enum(["active", "completed", "abandoned"])
          .optional()
          .describe("Filter by status"),
      }),
      execute: async (params) => {
        return this.analyzeGoals(params.status);
      },
    };

    // Create the system prompt for the goal agent
    const systemPrompt =
      config.systemPrompt ||
      `
You are a goal management agent that helps track objectives and progress.
Your role is to:
1. Create and organize goals and subgoals
2. Track the status of goals
3. Provide insights on goal progress
4. Help prioritize goals based on importance

Be strategic in goal management and help focus on the most important objectives.
`;

    // Call the base constructor with the tools
    super({
      ...config,
      tools: [
        addGoalTool,
        completeGoalTool,
        abandonGoalTool,
        addNoteToGoalTool,
        getGoalsTool,
        analyzeGoalsTool,
        ...(config.tools || []),
      ],
      systemPrompt,
    });

    // Initialize with any provided goals
    if (config.initialGoals) {
      for (const goalData of config.initialGoals) {
        this.addGoal(
          goalData.description,
          goalData.priority,
          goalData.parentId
        );
      }
    }
  }

  /**
   * Add a new goal
   */
  private addGoal(
    description: string,
    priority: number,
    parentId?: string
  ): Goal {
    const id = `goal_${++this.goalCounter}`;
    const createdAt = Date.now();

    const newGoal: Goal = {
      id,
      description,
      status: "active",
      priority,
      parentId,
      subgoals: [],
      createdAt,
      notes: [],
    };

    this.goals.set(id, newGoal);
    this.logger.info(`Added goal: ${description}`);

    // If this is a subgoal, add it to the parent's subgoals
    if (parentId) {
      const parentGoal = this.goals.get(parentId);
      if (parentGoal) {
        parentGoal.subgoals.push(id);
        this.logger.info(`Added subgoal to parent ${parentId}`);
      } else {
        this.logger.warn(`Parent goal ${parentId} not found`);
      }
    }

    return newGoal;
  }

  /**
   * Update a goal's status
   */
  private updateGoalStatus(
    id: string,
    status: "active" | "completed" | "abandoned",
    notes?: string
  ): Goal | null {
    const goal = this.goals.get(id);

    if (!goal) {
      this.logger.warn(`Goal with ID ${id} not found`);
      return null;
    }

    goal.status = status;

    if (status === "completed") {
      goal.completedAt = Date.now();
    }

    if (notes) {
      goal.notes.push(`[${status.toUpperCase()}] ${notes}`);
    }

    this.logger.info(`Updated goal ${id} status to ${status}`);

    return goal;
  }

  /**
   * Add a note to a goal
   */
  private addNoteToGoal(id: string, note: string): Goal | null {
    const goal = this.goals.get(id);

    if (!goal) {
      this.logger.warn(`Goal with ID ${id} not found`);
      return null;
    }

    goal.notes.push(note);
    this.logger.info(`Added note to goal ${id}`);

    return goal;
  }

  /**
   * Get goals filtered by status and/or priority
   */
  private getGoals(
    status?: "active" | "completed" | "abandoned",
    minPriority?: number,
    parentId?: string
  ): Goal[] {
    let filteredGoals = Array.from(this.goals.values());

    // Filter by status
    if (status) {
      filteredGoals = filteredGoals.filter((goal) => goal.status === status);
    }

    // Filter by minimum priority
    if (minPriority) {
      filteredGoals = filteredGoals.filter(
        (goal) => goal.priority >= minPriority
      );
    }

    // Filter by parent ID
    if (parentId) {
      filteredGoals = filteredGoals.filter(
        (goal) => goal.parentId === parentId
      );
    }

    // Sort by priority (descending)
    filteredGoals.sort((a, b) => b.priority - a.priority);

    return filteredGoals;
  }

  /**
   * Analyze goals and provide insights
   */
  private async analyzeGoals(
    status?: "active" | "completed" | "abandoned"
  ): Promise<string> {
    const goals = this.getGoals(status);

    if (goals.length === 0) {
      return "No goals found matching the criteria.";
    }

    // Group goals by priority
    const highPriority = goals.filter((g) => g.priority >= 8);
    const mediumPriority = goals.filter(
      (g) => g.priority >= 4 && g.priority < 8
    );
    const lowPriority = goals.filter((g) => g.priority < 4);

    // Count goals by status
    const activeCount = goals.filter((g) => g.status === "active").length;
    const completedCount = goals.filter((g) => g.status === "completed").length;
    const abandonedCount = goals.filter((g) => g.status === "abandoned").length;

    // Generate an analysis using the LLM
    const analysisPrompt = `
Please analyze the following goals:

## High Priority (8-10)
${highPriority
  .map((g) => `- [${g.status.toUpperCase()}] ${g.description}`)
  .join("\n")}

## Medium Priority (4-7)
${mediumPriority
  .map((g) => `- [${g.status.toUpperCase()}] ${g.description}`)
  .join("\n")}

## Low Priority (1-3)
${lowPriority
  .map((g) => `- [${g.status.toUpperCase()}] ${g.description}`)
  .join("\n")}

Status Summary:
- Active: ${activeCount}
- Completed: ${completedCount}
- Abandoned: ${abandonedCount}

Please provide:
1. A strategic assessment of the current goals
2. Recommendations for which goals to focus on next
3. Any patterns or insights from the goal structure
`;

    this.dialogue.user(analysisPrompt);
    const analysis = await this.generateAnalysis(analysisPrompt);
    return analysis;
  }

  /**
   * Generate an analysis using the model
   */
  private async generateAnalysis(message: string): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.dialogue.messages,
    });

    this.dialogue.assistant(result.text);
    this.trackModelUsage(this.model.modelId, result.usage);

    return result.text;
  }

  /**
   * Get all goals
   */
  public getAllGoals(): Goal[] {
    return Array.from(this.goals.values());
  }
}
