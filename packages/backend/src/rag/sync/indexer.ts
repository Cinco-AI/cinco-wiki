import type { Db } from "mongodb";
import { isGraphConfigured } from "../config.js";
import {
  deleteNoteGraph,
  upsertNoteGraph,
  upsertNotesGraph,
} from "../graph/upsert.js";
import { getLlmProvider } from "../llm/index.js";
import {
  loadPublishedNoteById,
  loadPublishedNotes,
} from "../notes-source.js";
import type { CatalogDocument } from "../types.js";
import {
  deletePointsByIds,
  deletePointsByNoteId,
  ensureCollection,
  listAllPointIds,
  patchNotePayloadStats,
  upsertDocuments,
} from "../vector/qdrant.js";
import { buildNoteDocuments } from "./documents.js";
import {
  clearNoteIndexMeta,
  markNoteIndexFailed,
  markNoteIndexed,
  markPublishedNotesIndexed,
  saveFullSyncResult,
} from "./meta.js";
import {
  releaseSyncLock,
  setLastResult,
  tryAcquireSyncLock,
  type SyncResult,
} from "./state.js";

export type { SyncResult } from "./state.js";

const EMBED_BATCH_SIZE = 32;
const RETRY_ATTEMPTS = 3;
/** Fail-soft Neo4j budget so a slow graph sync cannot exhaust the Lambda timeout. */
const GRAPH_SYNC_TIMEOUT_MS = 12_000;

function emptyCounts(error?: string): SyncResult {
  return {
    ok: false,
    notes: 0,
    chunks: 0,
    upserted: 0,
    error,
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts: number; label: string },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= options.attempts - 1) break;
      const delayMs = 500 * 2 ** attempt;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[rag] ${options.label} retry ${attempt + 1}/${options.attempts}: ${message} (wait ${delayMs}ms)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function embedAndUpsert(documents: CatalogDocument[]): Promise<number> {
  if (documents.length === 0) return 0;
  const llm = getLlmProvider();
  let upserted = 0;
  const totalBatches = Math.ceil(documents.length / EMBED_BATCH_SIZE);

  for (let i = 0; i < documents.length; i += EMBED_BATCH_SIZE) {
    const batchIndex = Math.floor(i / EMBED_BATCH_SIZE) + 1;
    const batch = documents.slice(i, i + EMBED_BATCH_SIZE);
    console.log(
      `[rag] embedding batch ${batchIndex}/${totalBatches} (size=${batch.length})`,
    );

    await withRetry(
      async () => {
        const vectors = await llm.embed(batch.map((d) => d.text));
        await upsertDocuments(batch, vectors);
      },
      {
        attempts: RETRY_ATTEMPTS,
        label: `batch ${batchIndex}/${totalBatches}`,
      },
    );

    upserted += batch.length;
  }

  return upserted;
}

async function pruneOrphans(documents: CatalogDocument[]): Promise<number> {
  const keep = new Set(documents.map((d) => d.pointId));
  const existing = await listAllPointIds();
  const orphans = existing.filter((id) => !keep.has(id));
  if (orphans.length === 0) return 0;
  console.log(`[rag] pruning ${orphans.length} orphan point(s)`);
  await deletePointsByIds(orphans);
  return orphans.length;
}

export async function runFullSync(db: Db): Promise<SyncResult> {
  if (!tryAcquireSyncLock()) {
    return emptyCounts("SYNC_IN_PROGRESS");
  }

  const started = Date.now();

  try {
    await ensureCollection();
    const notes = await loadPublishedNotes(db);
    console.log(`[rag] loaded ${notes.length} published note(s)`);

    const documents = notes.flatMap((n) => buildNoteDocuments(n));

    // Qdrant first — Neo4j must not block the vector index under the Lambda budget.
    const upserted = await embedAndUpsert(documents);
    const deleted = await pruneOrphans(documents);

    if (isGraphConfigured()) {
      try {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          upsertNotesGraph(db, notes).finally(() => {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () =>
                reject(
                  new Error(
                    `neo4j sync timed out after ${GRAPH_SYNC_TIMEOUT_MS}ms`,
                  ),
                ),
              GRAPH_SYNC_TIMEOUT_MS,
            );
          }),
        ]);
      } catch (graphError) {
        const msg =
          graphError instanceof Error ? graphError.message : String(graphError);
        console.warn(`[rag] neo4j full sync skipped/failed: ${msg}`);
      }
    }

    const durationMs = Date.now() - started;

    console.log(
      `[rag] sync complete: notes=${notes.length} chunks=${documents.length} upserted=${upserted} deleted=${deleted} durationMs=${durationMs}`,
    );

    const result: SyncResult = {
      ok: true,
      notes: notes.length,
      chunks: documents.length,
      upserted,
      deleted,
      durationMs,
    };
    setLastResult(result);
    await markPublishedNotesIndexed(
      db,
      notes.map((n) => n.id),
    );
    await saveFullSyncResult(db, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[rag] sync failed: ${message}`);
    const result: SyncResult = {
      ...emptyCounts(message),
      deleted: 0,
      durationMs: Date.now() - started,
    };
    setLastResult(result);
    await saveFullSyncResult(db, result);
    return result;
  } finally {
    releaseSyncLock();
  }
}

/** Incremental upsert for one note (or remove if not published). */
export async function upsertNoteIndex(
  db: Db,
  noteId: string,
): Promise<{
  ok: boolean;
  upserted: number;
  deleted: boolean;
  error?: string;
}> {
  try {
    await ensureCollection();
    const note = await loadPublishedNoteById(db, noteId);
    await deletePointsByNoteId(noteId);

    if (!note) {
      if (isGraphConfigured()) {
        await deleteNoteGraph(noteId).catch(() => undefined);
      }
      await clearNoteIndexMeta(db, noteId);
      return { ok: true, upserted: 0, deleted: true };
    }

    const documents = buildNoteDocuments(note);
    const upserted = await embedAndUpsert(documents);
    if (isGraphConfigured()) {
      await upsertNoteGraph(db, note).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[rag] neo4j upsert note ${noteId}: ${msg}`);
      });
    }
    await markNoteIndexed(db, noteId, { chunks: documents.length });
    return { ok: true, upserted, deleted: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[rag] upsert note ${noteId} failed:`, message);
    await markNoteIndexFailed(db, noteId, message).catch(() => undefined);
    return { ok: false, upserted: 0, deleted: false, error: message };
  }
}

export async function deleteNoteIndex(
  db: Db,
  noteId: string,
): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await ensureCollection();
    await deletePointsByNoteId(noteId);
    if (isGraphConfigured()) {
      await deleteNoteGraph(noteId).catch(() => undefined);
    }
    await clearNoteIndexMeta(db, noteId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[rag] delete note ${noteId} failed:`, message);
    return { ok: false, error: message };
  }
}

/**
 * Refresh Neo4j social edges + Qdrant payload stats (no re-embed).
 * Used after votes / comments / reactions.
 */
export async function syncNoteSocial(
  db: Db,
  noteId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const note = await loadPublishedNoteById(db, noteId);
    if (!note) {
      if (isGraphConfigured()) {
        await deleteNoteGraph(noteId).catch(() => undefined);
      }
      return { ok: true };
    }

    if (isGraphConfigured()) {
      await upsertNoteGraph(db, note);
    }

    await patchNotePayloadStats(noteId, {
      avgRating: note.avgRating,
      voteCount: note.voteCount,
      commentCount: note.commentCount,
      authorId: note.authorId,
      authorName: note.authorName,
    }).catch(() => undefined);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[rag] social sync note ${noteId} failed:`, message);
    return { ok: false, error: message };
  }
}
