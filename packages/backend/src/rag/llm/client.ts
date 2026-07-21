import OpenAI from "openai";
import type { ChatMessage } from "./types.js";

export type LlmClientOptions = {
  apiKey: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  timeout: number;
};

export function createLlmClient(options: LlmClientOptions): OpenAI {
  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.defaultHeaders,
    timeout: options.timeout,
    maxRetries: 0,
  });
}

export async function embedTexts(
  client: OpenAI,
  options: {
    texts: string[];
    model: string;
    dimensions: number;
    timeout: number;
  },
): Promise<number[][]> {
  const { texts, model, dimensions, timeout } = options;
  if (texts.length === 0) return [];

  const response = await client.embeddings.create(
    {
      model,
      input: texts,
      dimensions,
    },
    { timeout, maxRetries: 0 },
  );

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function chatCompletion(
  client: OpenAI,
  options: {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
  },
): Promise<string> {
  const response = await client.chat.completions.create({
    model: options.model,
    temperature: options.temperature ?? 0.1,
    messages: options.messages,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
