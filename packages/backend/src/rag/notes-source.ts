import { ObjectId, type Db } from "mongodb";
import { collections, type NoteDoc } from "../lib/db.js";
import { loadUsersByIds } from "./social-source.js";
import type { NoteSource } from "./types.js";

function toNoteSource(
  doc: NoteDoc,
  authorName: string | null,
): NoteSource {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    contentHtml: doc.contentHtml,
    tags: doc.tags ?? [],
    authorId: doc.authorId ? doc.authorId.toHexString() : null,
    authorName,
    avgRating: doc.avgRating ?? 0,
    voteCount: doc.voteCount ?? 0,
    commentCount: doc.commentCount ?? 0,
    status: doc.status,
    updatedAt: doc.updatedAt,
  };
}

async function attachAuthorNames(
  db: Db,
  docs: NoteDoc[],
): Promise<NoteSource[]> {
  const authorIds = docs
    .map((d) => (d.authorId ? d.authorId.toHexString() : null))
    .filter((id): id is string => !!id);
  const users = await loadUsersByIds(db, authorIds);
  return docs.map((d) => {
    const aid = d.authorId ? d.authorId.toHexString() : null;
    const u = aid ? users.get(aid) : null;
    const authorName = u ? `${u.firstName} ${u.lastName}`.trim() : null;
    return toNoteSource(d, authorName || null);
  });
}

export async function loadPublishedNotes(db: Db): Promise<NoteSource[]> {
  const docs = await collections
    .notes(db)
    .find({ status: "published" })
    .project({
      title: 1,
      contentHtml: 1,
      tags: 1,
      authorId: 1,
      avgRating: 1,
      voteCount: 1,
      commentCount: 1,
      status: 1,
      updatedAt: 1,
    })
    .toArray();
  return attachAuthorNames(db, docs as NoteDoc[]);
}

export async function loadPublishedNoteById(
  db: Db,
  noteId: string,
): Promise<NoteSource | null> {
  if (!ObjectId.isValid(noteId)) return null;
  const doc = await collections.notes(db).findOne({
    _id: new ObjectId(noteId),
    status: "published",
  });
  if (!doc) return null;
  const [source] = await attachAuthorNames(db, [doc]);
  return source ?? null;
}

export async function listTagNames(db: Db, limit = 100): Promise<string[]> {
  const tags = await collections
    .tags(db)
    .find({ count: { $gt: 0 } })
    .sort({ count: -1 })
    .limit(limit)
    .project({ name: 1 })
    .toArray();
  return tags.map((t) => t.name);
}
