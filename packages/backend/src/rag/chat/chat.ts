import { generateText, type CoreMessage } from "ai";
import type { Db } from "mongodb";
import { ragConfig } from "../config.js";
import {
  isCircuitOpen,
  recordLlmFailure,
  recordLlmSuccess,
} from "./circuit.js";
import {
  checkRateLimit,
  isLikelyJailbreak,
  isLikelyOffTopic,
  outOfScopeAnswer,
  sanitizeInput,
} from "./guardrails.js";
import { createChatModel } from "./model.js";
import { buildStreamSystemPrompt } from "./prompts.js";
import { createChatTools } from "./tools.js";
import type { StreamChatMessage } from "./types.js";

export type ChatJsonResult = {
  available: boolean;
  answer?: string;
  grounded?: boolean;
  error?: string;
};

function lastUserContent(messages: StreamChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return String(messages[i]?.content || "");
    }
  }
  return "";
}

function toCoreMessages(messages: StreamChatMessage[]): CoreMessage[] {
  return messages
    .filter(
      (m) =>
        m.role === "user" || m.role === "assistant" || m.role === "system",
    )
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: sanitizeInput(String(m.content || "")),
    }))
    .filter((m) => m.content.length > 0);
}

export async function handleChatJson(input: {
  db: Db;
  messages: StreamChatMessage[];
  locale?: string | null;
  sessionId?: string | null;
  clientKey?: string | null;
}): Promise<ChatJsonResult> {
  const rateKey = input.clientKey || input.sessionId || "anonymous";
  if (!checkRateLimit(rateKey)) {
    return { available: false, error: "RAG_RATE_LIMITED" };
  }

  if (isCircuitOpen()) {
    return { available: false, error: "RAG_UNAVAILABLE" };
  }

  const lastUser = sanitizeInput(lastUserContent(input.messages || []));
  if (!lastUser) {
    return {
      available: true,
      answer: outOfScopeAnswer(input.locale),
      grounded: false,
    };
  }

  if (isLikelyJailbreak(lastUser) || isLikelyOffTopic(lastUser)) {
    return {
      available: true,
      answer: outOfScopeAnswer(input.locale),
      grounded: false,
    };
  }

  const messages = toCoreMessages(input.messages || []);
  if (messages.length === 0) {
    return {
      available: true,
      answer: outOfScopeAnswer(input.locale),
      grounded: false,
    };
  }

  try {
    const result = await generateText({
      model: createChatModel(),
      system: buildStreamSystemPrompt(input.locale),
      messages,
      tools: createChatTools(input.db, input.locale),
      maxSteps: ragConfig.maxSteps,
      temperature: 0.2,
    });

    recordLlmSuccess();
    const answer = (result.text || "").trim();
    return {
      available: true,
      answer:
        answer ||
        outOfScopeAnswer(input.locale),
      grounded: (result.steps?.length ?? 0) > 0,
    };
  } catch (error) {
    recordLlmFailure();
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rag] chat error:", message);
    const isTimeout = /timeout|aborted|AbortError/i.test(message);
    return {
      available: false,
      error: isTimeout ? "RAG_TIMEOUT" : "RAG_UNAVAILABLE",
    };
  }
}
