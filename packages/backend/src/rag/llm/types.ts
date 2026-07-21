export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ILlmProvider {
  embed(texts: string[]): Promise<number[][]>;
  chat(
    messages: ChatMessage[],
    options?: { temperature?: number },
  ): Promise<string>;
}
