import fs from "fs";
import path from "path";
import winston from "winston";
import { BaseWorkflow } from "./workflows/base.js";

/**
 * Result of a workflow run including performance metrics
 */
export interface WorkflowResult {
  /** Name of the workflow */
  name: string;
  /** Display name of the workflow including configuration */
  displayName: string;
  /** Final score achieved in the game */
  score: number;
  /** Number of moves made during the game */
  moves: number;
  /** Whether the game completed naturally or timed out */
  completed: boolean;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Options for the workflow runner
 */
export interface RunnerOptions {
  /** Directory to save log files to */
  logDir?: string;
  /** Whether to save logs to files */
  saveLogs?: boolean;
  /** Log level to use */
  logLevel?: string;
  /** Whether to run workflows in parallel */
  parallel?: boolean;
  /** Maximum number of workflows to run in parallel (0 for unlimited) */
  maxConcurrent?: number;
}

/**
 * Runs multiple workflows and compares their results
 */
export class WorkflowRunner {
  private readonly workflows: BaseWorkflow[];
  private readonly options: Required<RunnerOptions>;
  private readonly mainLogger: winston.Logger;

  /**
   * Creates a new workflow runner
   * @param workflows Array of workflows to run
   * @param options Configuration options
   */
  constructor(workflows: BaseWorkflow[], options: RunnerOptions = {}) {
    this.workflows = workflows;
    this.options = {
      logDir: options.logDir ?? "./logs",
      saveLogs: options.saveLogs ?? true,
      logLevel: options.logLevel ?? "info",
      parallel: options.parallel ?? false,
      maxConcurrent: options.maxConcurrent ?? 0,
    };

    // Ensure log directory exists if saving logs
    if (this.options.saveLogs) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }

    // Create main logger
    this.mainLogger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => {
          return `[Runner] ${level}: ${message}`;
        })
      ),
      transports: [new winston.transports.Console()],
    });
  }

  /**
   * Runs all workflows and returns their results
   * @returns Array of workflow results
   */
  async runAll(): Promise<WorkflowResult[]> {
    this.mainLogger.info("Starting workflow comparison...");
    this.mainLogger.info("==============================");

    if (this.options.parallel) {
      return await this.runParallel();
    } else {
      return await this.runSequential();
    }
  }

  /**
   * Runs workflows sequentially
   * @returns Array of workflow results
   */
  private async runSequential(): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];

    for (const workflow of this.workflows) {
      const result = await this.runWorkflow(workflow);
      results.push(result);
    }

    return results;
  }

  /**
   * Runs workflows in parallel
   * @returns Array of workflow results
   */
  private async runParallel(): Promise<WorkflowResult[]> {
    const maxConcurrent = this.options.maxConcurrent;

    if (maxConcurrent <= 0 || maxConcurrent >= this.workflows.length) {
      // Run all workflows in parallel
      this.mainLogger.info(
        `Running all ${this.workflows.length} workflows in parallel`
      );
      const promises = this.workflows.map((workflow) =>
        this.runWorkflow(workflow)
      );
      return await Promise.all(promises);
    } else {
      // Run workflows in batches
      this.mainLogger.info(`Running workflows in batches of ${maxConcurrent}`);
      const results: WorkflowResult[] = [];

      // Process workflows in chunks
      for (let i = 0; i < this.workflows.length; i += maxConcurrent) {
        const batch = this.workflows.slice(i, i + maxConcurrent);
        this.mainLogger.info(
          `Processing batch ${Math.floor(i / maxConcurrent) + 1} (${
            batch.length
          } workflows)`
        );

        const batchPromises = batch.map((workflow) =>
          this.runWorkflow(workflow)
        );
        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);
      }

      return results;
    }
  }

  /**
   * Runs a single workflow
   * @param workflow The workflow to run
   * @returns The workflow result
   */
  private async runWorkflow(workflow: BaseWorkflow): Promise<WorkflowResult> {
    this.mainLogger.info(`Running workflow: ${workflow.displayName}`);

    const startTime = Date.now();
    let completed = true;

    try {
      // Run the workflow
      const { score, moves, gameEnded } = await workflow.run();
      const executionTimeMs = Date.now() - startTime;

      // Create result object
      const result: WorkflowResult = {
        name: workflow.name,
        displayName: workflow.displayName,
        score,
        moves,
        completed: gameEnded,
        executionTimeMs,
      };

      this.mainLogger.info(`Completed workflow: ${workflow.displayName}`);
      this.mainLogger.info(
        `Score: ${score}, Moves: ${moves}, Time: ${executionTimeMs}ms`
      );

      return result;
    } catch (error) {
      completed = false;
      this.mainLogger.error(
        `Error running workflow ${workflow.displayName}:`,
        error
      );

      // Create result object for failed run
      return {
        name: workflow.name,
        displayName: workflow.displayName,
        score: 0,
        moves: 0,
        completed: false,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generates a table comparing the results of all workflows
   * @param results Array of workflow results
   * @returns Formatted table string
   */
  static formatResultsTable(results: WorkflowResult[]): string {
    // Define column widths
    const columns = [
      { header: "Workflow", width: 40 },
      { header: "Score", width: 10 },
      { header: "Moves", width: 10 },
      { header: "Completed", width: 12 },
      { header: "Time", width: 15 },
    ];

    // Create header row
    const header = columns
      .map((col) => col.header.padEnd(col.width))
      .join(" | ");
    const separator = columns.map((col) => "-".repeat(col.width)).join("-+-");

    // Helper function to format time in human-readable format
    const formatTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000) % 60;
      const minutes = Math.floor(ms / (1000 * 60)) % 60;
      const hours = Math.floor(ms / (1000 * 60 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    // Create data rows
    const rows = results.map((result) => {
      return [
        result.displayName.padEnd(columns[0].width),
        result.score.toString().padEnd(columns[1].width),
        result.moves.toString().padEnd(columns[2].width),
        (result.completed ? "Yes" : "No").padEnd(columns[3].width),
        formatTime(result.executionTimeMs).padEnd(columns[4].width),
      ].join(" | ");
    });

    // Combine all parts
    return `${header}\n${separator}\n${rows.join("\n")}`;
  }
}
