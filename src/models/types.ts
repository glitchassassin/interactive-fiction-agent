import { generateText } from "ai";
/**
 * Type definitions for the interactive fiction agent
 */

/**
 * Message model representing a conversation message
 */
export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  metadata?: Record<string, any>;
  embedding?: Uint8Array;
}

/**
 * Memory model representing an agent's memory
 */
export interface Memory {
  id: string;
  agentId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  importance: number;
  embedding?: Uint8Array;
  metadata?: Record<string, any>;
}

export type Agent = {
  model: Parameters<typeof generateText>[0]["model"];
  systemPrompt?: Parameters<typeof generateText>[0]["system"];
};
