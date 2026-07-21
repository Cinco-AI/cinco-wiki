import { ragConfig } from "../config.js";
import { chatCompletion, createLlmClient, embedTexts } from "./client.js";
import type { ChatMessage, ILlmProvider } from "./types.js";

function resolveModel(model: string): string {
  return model.includes("/") ? model : `openai/${model}`;
}

export class OpenRouterProvider implements ILlmProvider {
  private client: ReturnType<typeof createLlmClient>;

  constructor() {
    if (!ragConfig.openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    this.client = createLlmClient({
      apiKey: ragConfig.openrouterApiKey,
      baseURL: ragConfig.openrouterBaseUrl,
      defaultHeaders: {
        "HTTP-Referer": ragConfig.openrouterReferer,
        "X-OpenRouter-Title": ragConfig.openrouterTitle,
      },
      timeout: ragConfig.requestTimeoutMs,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return embedTexts(this.client, {
      texts,
      model: resolveModel(ragConfig.embeddingModel),
      dimensions: ragConfig.embeddingDimensions,
      timeout: ragConfig.embedTimeoutMs,
    });
  }

  async chat(
    messages: ChatMessage[],
    options?: { temperature?: number },
  ): Promise<string> {
    return chatCompletion(this.client, {
      messages,
      model: resolveModel(ragConfig.chatModel),
      temperature: options?.temperature,
    });
  }
}
