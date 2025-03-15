import { Agent } from "./Agent.js";

/**
 * A test agent that simulates work with a random delay and generates random score and moves.
 */
export class RandomAgent extends Agent {
  /**
   * The name of the agent.
   */
  get name(): string {
    return "RandomAgent";
  }

  /**
   * Run the agent with a random delay and set random score and moves.
   */
  async run(): Promise<void> {
    // Random delay between 1-5 seconds
    const delaySeconds = Math.floor(Math.random() * 5) + 1;

    // Wait for the random delay
    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));

    // Set random score and moves between 0-100
    this.score = Math.floor(Math.random() * 101);
    this.moves = Math.floor(Math.random() * 101);
  }
}
