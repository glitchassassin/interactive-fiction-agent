import { Agent } from "./Agent.js";

/**
 * A test agent that simulates slower work with a longer delay and generates random score and moves.
 */
export class SlowAgent extends Agent {
  /**
   * The name of the agent.
   */
  get name(): string {
    return "SlowAgent";
  }

  /**
   * Run the agent with a longer delay and set random score and moves.
   */
  async run(): Promise<void> {
    // Longer delay between 3-8 seconds
    const delaySeconds = Math.floor(Math.random() * 6) + 3;

    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));

    // Set random score and moves between 0-100, with a bias toward higher scores
    this.score = Math.floor(Math.random() * 51) + 50; // 50-100
    this.moves = Math.floor(Math.random() * 101);
  }
}
