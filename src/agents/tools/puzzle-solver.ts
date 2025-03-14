import { z } from "zod";
import { BaseAgent, BaseAgentConfig, Tool } from "../base.js";
import { generateText } from "ai";

/**
 * Interface for a puzzle
 */
export interface Puzzle {
  id: string;
  description: string;
  status: "unsolved" | "in_progress" | "solved";
  clues: string[];
  attempts: {
    attempt: string;
    result: string;
    timestamp: number;
  }[];
  solution?: string;
  createdAt: number;
  solvedAt?: number;
}

/**
 * Configuration options for the PuzzleSolverAgent
 */
export interface PuzzleSolverAgentConfig extends BaseAgentConfig {
  /**
   * Maximum number of puzzles to store
   * @default 50
   */
  maxPuzzles?: number;
}

/**
 * Agent that helps solve puzzles in interactive fiction games
 */
export class PuzzleSolverAgent extends BaseAgent {
  private puzzles: Map<string, Puzzle> = new Map();
  private readonly maxPuzzles: number;
  private puzzleCounter: number = 0;

  constructor({ maxPuzzles = 50, ...config }: PuzzleSolverAgentConfig) {
    // Create puzzle solving tools
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
        return this.addPuzzle(params.description, params.initialClues || []);
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
        return this.addClue(params.puzzleId, params.clue);
      },
    };

    const recordAttemptTool: Tool = {
      name: "record_attempt",
      description: "Record an attempt to solve a puzzle",
      parameters: z.object({
        puzzleId: z.string().describe("ID of the puzzle"),
        attempt: z.string().describe("The attempted solution"),
        result: z.string().describe("The result of the attempt"),
      }),
      execute: async (params) => {
        return this.recordAttempt(
          params.puzzleId,
          params.attempt,
          params.result
        );
      },
    };

    const solvePuzzleTool: Tool = {
      name: "solve_puzzle",
      description: "Mark a puzzle as solved",
      parameters: z.object({
        puzzleId: z.string().describe("ID of the puzzle"),
        solution: z.string().describe("The solution to the puzzle"),
      }),
      execute: async (params) => {
        return this.solvePuzzle(params.puzzleId, params.solution);
      },
    };

    const analyzePuzzleTool: Tool = {
      name: "analyze_puzzle",
      description: "Analyze a puzzle and suggest possible solutions",
      parameters: z.object({
        puzzleId: z.string().describe("ID of the puzzle"),
      }),
      execute: async (params) => {
        return this.analyzePuzzle(params.puzzleId);
      },
    };

    const getPuzzlesTool: Tool = {
      name: "get_puzzles",
      description: "Get puzzles filtered by status",
      parameters: z.object({
        status: z
          .enum(["unsolved", "in_progress", "solved"])
          .optional()
          .describe("Filter by status"),
      }),
      execute: async (params) => {
        return this.getPuzzles(params.status);
      },
    };

    // Create the system prompt for the puzzle solver agent
    const systemPrompt =
      config.systemPrompt ||
      `
You are a puzzle-solving agent that helps solve puzzles in interactive fiction games.
Your role is to:
1. Track puzzles and their clues
2. Record solution attempts and their results
3. Analyze puzzles to suggest possible solutions
4. Keep track of solved puzzles and their solutions

Be methodical in your approach to puzzle solving, considering all available clues and past attempts.
`;

    // Call the base constructor with the tools
    super({
      ...config,
      tools: [
        addPuzzleTool,
        addClueTool,
        recordAttemptTool,
        solvePuzzleTool,
        analyzePuzzleTool,
        getPuzzlesTool,
        ...(config.tools || []),
      ],
      systemPrompt,
    });

    this.maxPuzzles = maxPuzzles;
  }

  /**
   * Add a new puzzle
   */
  private addPuzzle(description: string, initialClues: string[] = []): Puzzle {
    const id = `puzzle_${++this.puzzleCounter}`;
    const createdAt = Date.now();

    const newPuzzle: Puzzle = {
      id,
      description,
      status: "unsolved",
      clues: [...initialClues],
      attempts: [],
      createdAt,
    };

    this.puzzles.set(id, newPuzzle);
    this.logger.info(`Added puzzle: ${description}`);

    // If we exceed the maximum number of puzzles, remove the oldest ones
    if (this.puzzles.size > this.maxPuzzles) {
      const puzzleEntries = Array.from(this.puzzles.entries());
      puzzleEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);

      for (let i = 0; i < puzzleEntries.length - this.maxPuzzles; i++) {
        this.puzzles.delete(puzzleEntries[i][0]);
        this.logger.info(
          `Removed old puzzle: ${puzzleEntries[i][1].description}`
        );
      }
    }

    return newPuzzle;
  }

  /**
   * Add a clue to an existing puzzle
   */
  private addClue(puzzleId: string, clue: string): Puzzle | null {
    const puzzle = this.puzzles.get(puzzleId);

    if (!puzzle) {
      this.logger.warn(`Puzzle with ID ${puzzleId} not found`);
      return null;
    }

    // Don't add duplicate clues
    if (!puzzle.clues.includes(clue)) {
      puzzle.clues.push(clue);
      this.logger.info(`Added clue to puzzle ${puzzleId}`);

      // If the puzzle was unsolved, mark it as in progress now that we have a clue
      if (puzzle.status === "unsolved" && puzzle.clues.length === 1) {
        puzzle.status = "in_progress";
      }
    }

    return puzzle;
  }

  /**
   * Record an attempt to solve a puzzle
   */
  private recordAttempt(
    puzzleId: string,
    attempt: string,
    result: string
  ): Puzzle | null {
    const puzzle = this.puzzles.get(puzzleId);

    if (!puzzle) {
      this.logger.warn(`Puzzle with ID ${puzzleId} not found`);
      return null;
    }

    puzzle.attempts.push({
      attempt,
      result,
      timestamp: Date.now(),
    });

    // If the puzzle was unsolved, mark it as in progress now that we have an attempt
    if (puzzle.status === "unsolved") {
      puzzle.status = "in_progress";
    }

    this.logger.info(`Recorded attempt for puzzle ${puzzleId}: ${attempt}`);

    return puzzle;
  }

  /**
   * Mark a puzzle as solved
   */
  private solvePuzzle(puzzleId: string, solution: string): Puzzle | null {
    const puzzle = this.puzzles.get(puzzleId);

    if (!puzzle) {
      this.logger.warn(`Puzzle with ID ${puzzleId} not found`);
      return null;
    }

    puzzle.status = "solved";
    puzzle.solution = solution;
    puzzle.solvedAt = Date.now();

    this.logger.info(`Marked puzzle ${puzzleId} as solved: ${solution}`);

    return puzzle;
  }

  /**
   * Analyze a puzzle and suggest possible solutions
   */
  private async analyzePuzzle(puzzleId: string): Promise<string> {
    const puzzle = this.puzzles.get(puzzleId);

    if (!puzzle) {
      return `Puzzle with ID ${puzzleId} not found`;
    }

    if (puzzle.status === "solved") {
      return `This puzzle is already solved. Solution: ${puzzle.solution}`;
    }

    // Generate an analysis using the LLM
    const analysisPrompt = `
Please analyze this puzzle and suggest possible solutions:

## Puzzle Description
${puzzle.description}

## Clues (${puzzle.clues.length})
${puzzle.clues.map((clue, index) => `${index + 1}. ${clue}`).join("\n")}

## Previous Attempts (${puzzle.attempts.length})
${puzzle.attempts
  .map(
    (attempt) =>
      `- Attempt: "${attempt.attempt}"\n  Result: "${attempt.result}"`
  )
  .join("\n\n")}

Based on the description, clues, and previous attempts, please:
1. Analyze what the puzzle is asking for
2. Identify patterns or connections between the clues
3. Suggest 2-3 specific commands or solutions to try next
4. Explain your reasoning for each suggestion
`;

    this.dialogue.user(analysisPrompt);
    const analysis = await this.generateAnalysis(analysisPrompt);
    return analysis;
  }

  /**
   * Get puzzles filtered by status
   */
  private getPuzzles(status?: "unsolved" | "in_progress" | "solved"): Puzzle[] {
    let filteredPuzzles = Array.from(this.puzzles.values());

    // Filter by status
    if (status) {
      filteredPuzzles = filteredPuzzles.filter(
        (puzzle) => puzzle.status === status
      );
    }

    // Sort by creation date (newest first)
    filteredPuzzles.sort((a, b) => b.createdAt - a.createdAt);

    return filteredPuzzles;
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
   * Get all puzzles
   */
  public getAllPuzzles(): Puzzle[] {
    return Array.from(this.puzzles.values());
  }
}
