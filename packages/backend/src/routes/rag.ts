import { Hono } from "hono";
import { z } from "zod";
import { handleChatJson } from "../rag/chat/chat.js";
import { isGraphConfigured, isRagConfigured } from "../rag/config.js";
import { pingNeo4j } from "../rag/graph/neo4j.js";
import { mcpRoutes } from "../rag/mcp/server.js";
import { getMergedSyncStatus } from "../rag/sync/meta.js";
import { getSyncStatus } from "../rag/sync/state.js";
import { runFullSync } from "../rag/sync/indexer.js";
import { pingQdrant } from "../rag/vector/qdrant.js";
import {
  body,
  errors,
  requireAdmin,
  type AppEnv,
} from "../lib/http.js";

export const ragRoutes = new Hono<AppEnv>();

ragRoutes.route("/", mcpRoutes);

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "data", "tool"]),
        content: z.string(),
      }),
    )
    .min(1),
  locale: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
});

ragRoutes.get("/health", async (c) => {
  if (!isRagConfigured()) {
    return c.json({ ok: false, configured: false }, 503);
  }
  const [qdrant, neo4j] = await Promise.all([pingQdrant(), pingNeo4j()]);
  return c.json({
    ok: qdrant,
    configured: true,
    qdrant,
    neo4j,
    graphConfigured: isGraphConfigured(),
  });
});

ragRoutes.post("/chat", async (c) => {
  if (!isRagConfigured()) {
    return c.json({ available: false, error: "RAG_DISABLED" }, 503);
  }

  const input = await body(c, chatSchema);
  const clientKey =
    c.req.header("x-forwarded-for") ||
    c.req.header("x-real-ip") ||
    input.sessionId ||
    c.get("userId");

  const result = await handleChatJson({
    db: c.get("db"),
    messages: input.messages,
    locale: input.locale ?? "fr",
    sessionId: input.sessionId ?? null,
    clientKey: String(clientKey),
  });

  if (result.error === "RAG_RATE_LIMITED") {
    return c.json(result, 429);
  }
  if (!result.available && result.error) {
    return c.json(result, 503);
  }
  return c.json(result);
});

ragRoutes.post("/admin/sync", requireAdmin, async (c) => {
  if (!isRagConfigured()) {
    throw errors.badRequest("RAG non configuré (QDRANT_URL / LLM)");
  }
  const result = await runFullSync(c.get("db"));
  if (result.error === "SYNC_IN_PROGRESS") {
    return c.json(result, 409);
  }
  return c.json(result, result.ok ? 200 : 500);
});

ragRoutes.get("/admin/sync/status", requireAdmin, async (c) => {
  const status = await getMergedSyncStatus(c.get("db"), getSyncStatus());
  return c.json(status);
});
