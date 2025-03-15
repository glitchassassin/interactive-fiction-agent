/**
 * Abstract base class for all agents.
 * All agent implementations must extend this class and implement the abstract methods.
 */
export abstract class Agent {
  /**
   * The name of the agent. Must be implemented by subclasses.
   */
  abstract get name(): string;

  /**
   * The current score of the agent.
   */
  public score: number = 0;

  /**
   * The number of moves the agent has made.
   */
  public moves: number = 0;

  /**
   * Run the agent. Must be implemented by subclasses.
   * @returns A promise that resolves when the agent has completed its run.
   */
  abstract run(): Promise<void>;
}
