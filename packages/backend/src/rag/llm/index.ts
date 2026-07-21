import { ragConfig } from "../config.js";
import { OpenAiProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { ILlmProvider } from "./types.js";

let provider: ILlmProvider | null = null;

export function getLlmProvider(): ILlmProvider {
  if (!provider) {
    if (ragConfig.llmProvider === "openrouter") {
      provider = new OpenRouterProvider();
    } else if (ragConfig.llmProvider === "openai") {
      provider = new OpenAiProvider();
    } else {
      throw new Error(
        `Invalid LLM_PROVIDER "${ragConfig.llmProvider}". Use "openai" or "openrouter".`,
      );
    }
  }
  return provider;
}

export type { ILlmProvider, ChatMessage } from "./types.js";
