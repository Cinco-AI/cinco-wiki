export type StreamChatMessage = {
  role: "system" | "user" | "assistant" | "data" | "tool";
  content: string;
};

export type StreamChatRequest = {
  messages: StreamChatMessage[];
  locale?: string | null;
  sessionId?: string | null;
  clientKey?: string | null;
};
