import { CoreMessage } from "ai";

/**
 * Dialogue class to manage conversation history
 */
export class Dialogue {
  public messages: CoreMessage[];
  private limit: number;

  /**
   * Create a new Dialogue instance
   * @param limit Maximum number of messages to keep in history
   */
  constructor(limit: number = 50) {
    this.messages = [];
    this.limit = limit;
  }

  /**
   * Add a user message to the dialogue
   * @param content Message content (will be stringified if not a string)
   * @returns The Dialogue instance for chaining
   */
  user(content: any): Dialogue {
    const messageContent =
      typeof content === "string" ? content : JSON.stringify(content);
    this.messages.push({
      role: "user",
      content: messageContent,
    });
    this.trimMessages();
    return this;
  }

  /**
   * Add an assistant message to the dialogue
   * @param content Message content (will be stringified if not a string)
   * @returns The Dialogue instance for chaining
   */
  assistant(content: any): Dialogue {
    const messageContent =
      typeof content === "string" ? content : JSON.stringify(content);
    this.messages.push({
      role: "assistant",
      content: messageContent,
    });
    this.trimMessages();
    return this;
  }

  /**
   * Add a system message to the dialogue
   * @param content Message content (will be stringified if not a string)
   * @returns The Dialogue instance for chaining
   */
  system(content: any): Dialogue {
    const messageContent =
      typeof content === "string" ? content : JSON.stringify(content);
    this.messages.push({
      role: "system",
      content: messageContent,
    });
    this.trimMessages();
    return this;
  }

  /**
   * Add a tool message to the dialogue
   * @param toolCallId The ID of the tool call this result is associated with
   * @param toolName The name of the tool that generated this result
   * @param result The result of the tool call (will be stringified if not a string)
   * @returns The Dialogue instance for chaining
   */
  tool(toolCallId: string, toolName: string, result: any): Dialogue {
    const resultContent =
      typeof result === "string" ? result : JSON.stringify(result);
    this.messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId,
          toolName,
          result: resultContent,
        },
      ],
    } as CoreMessage);
    this.trimMessages();
    return this;
  }

  /**
   * Trim messages to the limit
   */
  private trimMessages(): void {
    if (this.messages.length > this.limit) {
      this.messages.splice(0, this.messages.length - this.limit);
    }
  }
}
