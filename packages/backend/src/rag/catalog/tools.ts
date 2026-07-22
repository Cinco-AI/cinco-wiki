import type { Db } from "mongodb";
import { htmlToText } from "../html.js";
import { retrieveNotes } from "../chat/retrieve.js";
import {
  authorsByTag as queryAuthorsByTag,
  graphPathBetweenNotes,
  mostCommentedNotes as queryMostCommentedNotes,
  noteComments as queryNoteComments,
  noteRatings as queryNoteRatings,
  notesByAuthor as queryNotesByAuthor,
  notesBySharedTags as queryNotesBySharedTags,
  notesCommentedByUser as queryNotesCommentedByUser,
  notesRatedByUser as queryNotesRatedByUser,
  relatedNotes as queryRelatedNotes,
  topRatedNotes as queryTopRatedNotes,
} from "../graph/query.js";
import {
  findPublishedNotes,
  listTagNames,
  loadPublishedNoteById,
  loadTopContributors,
  type FindNotesArgs,
} from "../notes-source.js";
import { findHitsByNoteId, scrollByType } from "../vector/qdrant.js";

function displayTitle(payload: Record<string, unknown>): string {
  return String(payload.title || payload.label || "");
}

export async function searchNotes(args: {
  query: string;
  limit?: number;
}) {
  const hits = await retrieveNotes(args.query, { limit: args.limit });
  const seen = new Set<string>();
  const notes: Array<{
    noteId: string;
    title: string;
    tags: string[];
    urlPath: string;
    excerpt: string;
    score: number;
  }> = [];

  for (const hit of hits) {
    const noteId = String(hit.payload.noteId || "");
    if (!noteId || seen.has(noteId)) continue;
    seen.add(noteId);
    const tags = Array.isArray(hit.payload.tags)
      ? (hit.payload.tags as string[])
      : [];
    notes.push({
      noteId,
      title: displayTitle(hit.payload),
      tags,
      urlPath: String(hit.payload.urlPath || `/${noteId}`),
      excerpt: String(hit.payload.text || "").slice(0, 400),
      score: hit.score,
    });
  }

  return { notes, grounded: notes.length > 0 };
}

export async function getNote(db: Db, args: { noteIdOrTitle: string }) {
  const needle = args.noteIdOrTitle.trim();
  if (!needle) return null;

  const fromDb = await loadPublishedNoteById(db, needle);
  if (fromDb) {
    return {
      noteId: fromDb.id,
      title: fromDb.title,
      tags: fromDb.tags,
      authorName: fromDb.authorName,
      avgRating: fromDb.avgRating,
      voteCount: fromDb.voteCount,
      commentCount: fromDb.commentCount,
      urlPath: `/${fromDb.id}`,
      content: htmlToText(fromDb.contentHtml).slice(0, 4000),
    };
  }

  const byIdHits = await findHitsByNoteId(needle);
  if (byIdHits[0]) {
    const p = byIdHits[0].payload;
    return {
      noteId: String(p.noteId || needle),
      title: displayTitle(p),
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      urlPath: String(p.urlPath || `/${p.noteId}`),
      content: byIdHits
        .map((h) => String(h.payload.text || ""))
        .join("\n\n")
        .slice(0, 4000),
    };
  }

  const semantic = await retrieveNotes(needle, { limit: 5 });
  const match =
    semantic.find(
      (h) =>
        displayTitle(h.payload).toLowerCase() === needle.toLowerCase() ||
        String(h.payload.noteId) === needle,
    ) ?? semantic[0];

  if (!match) return null;

  const noteId = String(match.payload.noteId || "");
  const dbNote = noteId ? await loadPublishedNoteById(db, noteId) : null;
  if (dbNote) {
    return {
      noteId: dbNote.id,
      title: dbNote.title,
      tags: dbNote.tags,
      authorName: dbNote.authorName,
      avgRating: dbNote.avgRating,
      voteCount: dbNote.voteCount,
      commentCount: dbNote.commentCount,
      urlPath: `/${dbNote.id}`,
      content: htmlToText(dbNote.contentHtml).slice(0, 4000),
    };
  }

  return {
    noteId,
    title: displayTitle(match.payload),
    tags: Array.isArray(match.payload.tags)
      ? (match.payload.tags as string[])
      : [],
    urlPath: String(match.payload.urlPath || `/${noteId}`),
    content: String(match.payload.text || "").slice(0, 4000),
  };
}

export async function listTags(db: Db) {
  const tags = await listTagNames(db, 80);
  if (tags.length > 0) {
    return { tags };
  }

  const hits = await scrollByType("note", 100);
  const set = new Set<string>();
  for (const hit of hits) {
    const tagsArr = Array.isArray(hit.payload.tags)
      ? (hit.payload.tags as string[])
      : [];
    for (const t of tagsArr) set.add(t);
  }
  return { tags: [...set].sort() };
}

/** Listing notes avec filtres structurés (Mongo — dates, liens, tris). */
export async function findNotes(db: Db, args: FindNotesArgs = {}) {
  const result = await findPublishedNotes(db, args);
  return {
    ...result,
    grounded: result.notes.length > 0,
  };
}

/** @deprecated Préférer findNotes({ sort: "createdAt" }). Alias de compat. */
export async function listRecentNotes(db: Db) {
  return findNotes(db, { sort: "createdAt", limit: 40 });
}

export async function relatedNotes(args: {
  noteIdOrTitle: string;
  depth?: number;
}) {
  return queryRelatedNotes(args.noteIdOrTitle, args.depth ?? 1);
}

export async function notesBySharedTags(args: {
  noteIdOrTitle: string;
  limit?: number;
}) {
  return queryNotesBySharedTags({
    noteIdOrTitle: args.noteIdOrTitle,
    limit: args.limit,
  });
}

export async function graphPath(args: { from: string; to: string }) {
  return graphPathBetweenNotes({ from: args.from, to: args.to });
}

export async function topRatedNotes(args: { limit?: number; tag?: string }) {
  return queryTopRatedNotes(args);
}

export async function mostCommentedNotes(args: { limit?: number }) {
  return queryMostCommentedNotes(args);
}

export async function notesByAuthor(args: { nameOrId: string }) {
  return queryNotesByAuthor(args);
}

export async function noteRatings(args: { noteIdOrTitle: string }) {
  return queryNoteRatings(args);
}

export async function notesRatedByUser(args: {
  nameOrId: string;
  minValue?: number;
}) {
  return queryNotesRatedByUser(args);
}

export async function noteComments(args: {
  noteIdOrTitle: string;
  limit?: number;
}) {
  return queryNoteComments(args);
}

export async function notesCommentedByUser(args: { nameOrId: string }) {
  return queryNotesCommentedByUser(args);
}

export async function authorsByTag(args: { tag: string }) {
  return queryAuthorsByTag(args);
}

export async function topContributors(
  db: Db,
  args?: { limit?: number },
) {
  const authors = await loadTopContributors(db, args?.limit ?? 10);
  return { authors, grounded: authors.length > 0 };
}
