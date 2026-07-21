import type { Db } from "mongodb";
import { isGraphConfigured, isRagConfigured } from "./config.js";
import {
  deleteNoteIndex,
  syncNoteSocial,
  upsertNoteIndex,
} from "./sync/indexer.js";

/**
 * Best-effort index update after note write.
 * No-op if Qdrant / LLM not configured.
 */
export function scheduleNoteIndexUpsert(db: Db, noteId: string): void {
  if (!isRagConfigured()) return;
  void upsertNoteIndex(db, noteId).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[rag] upsert failed:", message);
  });
}

export function scheduleNoteIndexDelete(db: Db, noteId: string): void {
  if (!isRagConfigured()) return;
  void deleteNoteIndex(db, noteId).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[rag] delete failed:", message);
  });
}

/** After vote / comment / reaction — refresh Neo4j + Qdrant stats. */
export function scheduleNoteSocialSync(db: Db, noteId: string): void {
  if (!isRagConfigured() && !isGraphConfigured()) return;
  void syncNoteSocial(db, noteId).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[rag] social sync failed:", message);
  });
}
