import { generateText, type CoreMessage } from "ai";
import type { Db } from "mongodb";
import {
  findNotes,
  listTags,
  topContributors,
} from "../catalog/tools.js";
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
  rateLimitedAnswer,
  sanitizeInput,
  temporaryUnavailableAnswer,
  timeoutAnswer,
} from "./guardrails.js";
import { resolveChatIntent, type ResolvedIntent } from "./intent.js";
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

async function prefetchToolData(
  db: Db,
  intent: Extract<ResolvedIntent, { kind: "prefetch" }>,
): Promise<unknown> {
  switch (intent.tool) {
    case "findNotes":
      return findNotes(db, intent.args);
    case "topContributors":
      return topContributors(db, intent.args);
    case "listTags":
      return listTags(db);
    default:
      return null;
  }
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
    return {
      available: true,
      answer: rateLimitedAnswer(input.locale),
      grounded: false,
      error: "RAG_RATE_LIMITED",
    };
  }

  if (isCircuitOpen()) {
    return {
      available: true,
      answer: temporaryUnavailableAnswer(input.locale),
      grounded: false,
      error: "RAG_UNAVAILABLE",
    };
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

  const intent = resolveChatIntent(lastUser);

  try {
    if (intent.kind === "prefetch") {
      const data = await prefetchToolData(input.db, intent);
      const grounded =
        data != null &&
        typeof data === "object" &&
        ("grounded" in data
          ? Boolean((data as { grounded?: boolean }).grounded)
          : true);

      const result = await generateText({
        model: createChatModel(),
        system: `${buildStreamSystemPrompt(input.locale, intent)}

Données outils (faites, à utiliser telles quelles) :
${JSON.stringify(data, null, 2)}`,
        messages,
        temperature: 0.2,
      });

      recordLlmSuccess();
      const answer = (result.text || "").trim();
      return {
        available: true,
        answer: answer || outOfScopeAnswer(input.locale),
        grounded,
      };
    }

    const result = await generateText({
      model: createChatModel(),
      system: buildStreamSystemPrompt(input.locale, intent),
      messages,
      tools: createChatTools(input.db, input.locale),
      maxSteps: ragConfig.maxSteps,
      temperature: 0.2,
    });

    recordLlmSuccess();
    const answer = (result.text || "").trim();
    return {
      available: true,
      answer: answer || outOfScopeAnswer(input.locale),
      grounded: (result.steps?.length ?? 0) > 0,
    };
  } catch (error) {
    recordLlmFailure();
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rag] chat error:", message);
    const isTimeout = /timeout|aborted|AbortError/i.test(message);
    return {
      available: true,
      answer: isTimeout
        ? timeoutAnswer(input.locale)
        : temporaryUnavailableAnswer(input.locale),
      grounded: false,
      error: isTimeout ? "RAG_TIMEOUT" : "RAG_UNAVAILABLE",
    };
  }
}
