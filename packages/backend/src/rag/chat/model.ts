import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "@ai-sdk/provider";
import { ragConfig } from "../config.js";

function resolveOpenRouterModel(model: string): string {
  return model.includes("/") ? model : `openai/${model}`;
}

export function createChatModel(): LanguageModelV1 {
  if (ragConfig.llmProvider === "openrouter") {
    if (!ragConfig.openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    const openrouter = createOpenAI({
      apiKey: ragConfig.openrouterApiKey,
      baseURL: ragConfig.openrouterBaseUrl,
      headers: {
        "HTTP-Referer": ragConfig.openrouterReferer,
        "X-OpenRouter-Title": ragConfig.openrouterTitle,
      },
    });
    return openrouter(resolveOpenRouterModel(ragConfig.chatModel));
  }

  if (!ragConfig.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = createOpenAI({
    apiKey: ragConfig.openaiApiKey,
    baseURL: ragConfig.openaiBaseUrl,
  });
  return openai(ragConfig.chatModel);
}
