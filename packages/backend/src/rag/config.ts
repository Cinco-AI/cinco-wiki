/** Config RAG (optionnelle — si Qdrant / LLM absents, les routes renvoient RAG_DISABLED). */
import "dotenv/config"; // Load the .env file
export type LlmProvider = "openai" | "openrouter";

const llmProvider = (process.env.LLM_PROVIDER || "openai") as LlmProvider;

export const ragConfig = {
  qdrantUrl: process.env.QDRANT_URL || "",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",
  qdrantCollection: process.env.QDRANT_COLLECTION || "cinco_wiki",
  neo4jUri: process.env.NEO4J_URI || "",
  neo4jUser: process.env.NEO4J_USER || "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD || "",
  llmProvider,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
  openaiBaseUrl:
    process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || undefined,
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "https://openrouter.ai/api/v1",
  openrouterReferer:
    process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3001",
  openrouterTitle: process.env.OPENROUTER_APP_NAME || "CincoWikiRAG",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  chatModel: process.env.CHAT_MODEL || "gpt-4o-mini",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 1536),
  minScore: Number(process.env.RAG_MIN_SCORE || 0.22),
  maxInputChars: Number(process.env.RAG_MAX_INPUT_CHARS || 2000),
  rateLimitPerMin: Number(process.env.RAG_RATE_LIMIT || 30),
  topK: Number(process.env.RAG_TOP_K || 8),
  requestTimeoutMs: Number(process.env.RAG_TIMEOUT_MS || 25000),
  embedTimeoutMs: Number(process.env.RAG_EMBED_TIMEOUT_MS || 60000),
  chunkSize: Number(process.env.RAG_CHUNK_SIZE || 1000),
  chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP || 150),
  /** Max tool steps for non-stream chat (Lambda timeout budget). */
  maxSteps: Number(process.env.RAG_MAX_STEPS || 3),
};

export function isRagConfigured(): boolean {
  return Boolean(ragConfig.qdrantUrl) && isLlmConfigured();
}

export function isLlmConfigured(): boolean {
  if (ragConfig.llmProvider === "openrouter") {
    return Boolean(ragConfig.openrouterApiKey);
  }
  return Boolean(ragConfig.openaiApiKey);
}

/** GraphRAG (Neo4j) — optionnel ; actif seulement si URI + credentials + RAG. */
export function isGraphConfigured(): boolean {
  return (
    isRagConfigured() &&
    Boolean(ragConfig.neo4jUri && ragConfig.neo4jUser && ragConfig.neo4jPassword)
  );
}
