import { ObjectId, type Db } from "mongodb";
import { collections } from "../../lib/db.js";
import type { SyncResult, SyncStatus } from "./state.js";

const RAG_META_ID = "sync";

type RagMetaDoc = {
  _id: typeof RAG_META_ID;
  lastFullSyncAt: Date;
  lastFullSyncResult: SyncResult;
};

function ragMetaCollection(db: Db) {
  return db.collection<RagMetaDoc>("rag_meta");
}

export async function markNoteIndexed(
  db: Db,
  noteId: string,
  _options?: { chunks?: number },
): Promise<void> {
  if (!ObjectId.isValid(noteId)) return;
  await collections.notes(db).updateOne(
    { _id: new ObjectId(noteId) },
    {
      $set: { ragIndexedAt: new Date(), ragIndexError: null },
    },
  );
}

export async function markNoteIndexFailed(
  db: Db,
  noteId: string,
  error: string,
): Promise<void> {
  if (!ObjectId.isValid(noteId)) return;
  await collections.notes(db).updateOne(
    { _id: new ObjectId(noteId) },
    {
      $set: { ragIndexError: error },
    },
  );
}

export async function clearNoteIndexMeta(db: Db, noteId: string): Promise<void> {
  if (!ObjectId.isValid(noteId)) return;
  await collections.notes(db).updateOne(
    { _id: new ObjectId(noteId) },
    {
      $unset: { ragIndexedAt: "", ragIndexError: "" },
    },
  );
}

export async function markPublishedNotesIndexed(
  db: Db,
  noteIds: string[],
): Promise<void> {
  const now = new Date();
  const ids = noteIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (ids.length === 0) return;

  await collections.notes(db).updateMany(
    { _id: { $in: ids } },
    {
      $set: { ragIndexedAt: now, ragIndexError: null },
    },
  );
}

export async function saveFullSyncResult(db: Db, result: SyncResult): Promise<void> {
  const now = new Date();
  await ragMetaCollection(db).updateOne(
    { _id: RAG_META_ID },
    {
      $set: {
        lastFullSyncAt: now,
        lastFullSyncResult: result,
      },
    },
    { upsert: true },
  );
}

export async function loadPersistedSyncStatus(db: Db): Promise<SyncStatus | null> {
  const doc = await ragMetaCollection(db).findOne({ _id: RAG_META_ID });
  if (!doc) return null;

  return {
    running: false,
    lastStartedAt: null,
    lastFinishedAt: doc.lastFullSyncAt.toISOString(),
    lastResult: doc.lastFullSyncResult,
  };
}

/** Fusionne l'état en mémoire (Lambda courante) et le doc Mongo (survit aux cold starts). */
export async function getMergedSyncStatus(
  db: Db,
  memory: SyncStatus,
): Promise<SyncStatus> {
  const persisted = await loadPersistedSyncStatus(db);
  if (!persisted?.lastFinishedAt || !persisted.lastResult) {
    return memory;
  }

  if (memory.running) {
    return memory;
  }

  const memoryTs = memory.lastFinishedAt
    ? Date.parse(memory.lastFinishedAt)
    : 0;
  const persistedTs = Date.parse(persisted.lastFinishedAt);

  if (persistedTs > memoryTs) {
    return {
      running: memory.running,
      lastStartedAt: memory.lastStartedAt ?? persisted.lastStartedAt,
      lastFinishedAt: persisted.lastFinishedAt,
      lastResult: persisted.lastResult,
    };
  }

  return memory;
}
