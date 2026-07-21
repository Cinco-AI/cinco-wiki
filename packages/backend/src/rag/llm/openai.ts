import { ragConfig } from "../config.js";
import { chatCompletion, createLlmClient, embedTexts } from "./client.js";
import type { ChatMessage, ILlmProvider } from "./types.js";

export class OpenAiProvider implements ILlmProvider {
  private client: ReturnType<typeof createLlmClient>;

  constructor() {
    if (!ragConfig.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    this.client = createLlmClient({
      apiKey: ragConfig.openaiApiKey,
      baseURL: ragConfig.openaiBaseUrl,
      timeout: ragConfig.requestTimeoutMs,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return embedTexts(this.client, {
      texts,
      model: ragConfig.embeddingModel,
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
      model: ragConfig.chatModel,
      temperature: options?.temperature,
    });
  }
}
