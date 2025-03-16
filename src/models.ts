import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { ollama } from "ollama-ai-provider";

// Ollama models
export const MISTRAL = ollama("mistral");
export const GEMMA_3 = ollama("gemma3:12b");
export const GEMMA_3_ENHANCED = ollama("ebdm/gemma3-enhanced:12b");
export const DEEPSEEK_R1 = ollama("deepseek-r1");
export const DEEPSEEK_R1_14B = ollama("deepseek-r1:14b");
export const DEEPSEEK_R1_TOOL_CALLING = ollama(
  "MFDoom/deepseek-r1-tool-calling:14b"
);

// OpenAI models
// $2.50 / $10.00 per million tokens in/out
export const GPT_4O = openai("gpt-4o");
// $0.150 / $0.600 per million tokens in/out
export const GPT_4O_MINI = openai("gpt-4o-mini");
// $1.10 / $4.40 per million tokens in/out
export const GPT_O3_MINI = openai("o3-mini");

// Anthropic models
// $0.80 / $4.00 per million tokens in/out
export const CLAUDE_3_HAIKU = anthropic("claude-3-5-haiku-20241022");
// $3.00 / $15.00	 per million tokens in/out
export const CLAUDE_3_SONNET = anthropic("claude-3-7-sonnet-20250219");

// Grok models
// $2.00 / $10.00 per million tokens in/out
export const GROK_2 = xai("grok-2-1212");
