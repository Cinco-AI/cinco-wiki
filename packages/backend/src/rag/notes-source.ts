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

export type TopContributor = {
  id: string;
  name: string;
  noteCount: number;
};

export type FindNotesSort = "createdAt" | "avgRating" | "commentCount";

export type FindNotesArgs = {
  sinceDays?: number | null;
  /** Host whitelisté (ex. youtube.com) — jamais une regex libre du LLM. */
  linkHost?: string | null;
  sort?: FindNotesSort | null;
  limit?: number | null;
};

export type FoundNote = {
  noteId: string;
  title: string;
  urlPath: string;
  createdAt: string;
  avgRating: number;
  commentCount: number;
  youtubeUrl?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalise linkHost → motif sûr pour links.url / contentHtml. */
function linkHostRegex(linkHost: string): RegExp | null {
  const host = linkHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (!host || host.length > 64) return null;
  if (host === "youtube.com" || host === "youtu.be") {
    return /youtube\.com|youtu\.be/i;
  }
  return new RegExp(escapeRegex(host), "i");
}

function extractYoutubeUrl(doc: NoteDoc): string | undefined {
  for (const link of doc.links ?? []) {
    const url = String(link.url || "");
    if (/youtube\.com|youtu\.be/i.test(url)) return url;
  }
  const html = doc.contentHtml || "";
  const m = html.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s"'<>]+|youtu\.be\/[^\s"'<>]+)/i,
  );
  return m?.[0];
}

/** Listing structuré Mongo (filtres whitelistés uniquement). */
export async function findPublishedNotes(
  db: Db,
  args: FindNotesArgs = {},
): Promise<{ notes: FoundNote[]; filters: FindNotesArgs }> {
  const limit = Math.min(
    Math.max(1, Math.floor(args.limit ?? 20)),
    50,
  );
  const sortKey: FindNotesSort =
    args.sort === "avgRating" || args.sort === "commentCount"
      ? args.sort
      : "createdAt";

  const filter: Record<string, unknown> = { status: "published" };

  if (args.sinceDays != null && Number.isFinite(args.sinceDays)) {
    const days = Math.min(Math.max(1, Math.floor(args.sinceDays)), 365);
    filter.createdAt = {
      $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    };
  }

  if (args.linkHost) {
    const re = linkHostRegex(args.linkHost);
    if (re) {
      filter.$or = [
        { "links.url": re },
        { "links.domain": re },
        { contentHtml: re },
      ];
    }
  }

  const docs = await collections
    .notes(db)
    .find(filter)
    .sort({ [sortKey]: -1 })
    .limit(limit)
    .project({
      title: 1,
      createdAt: 1,
      avgRating: 1,
      commentCount: 1,
      links: 1,
      contentHtml: 1,
    })
    .toArray();

  const wantYoutube =
    !!args.linkHost &&
    /youtube|youtu\.be/i.test(String(args.linkHost));

  const notes: FoundNote[] = (docs as NoteDoc[]).map((doc) => {
    const noteId = doc._id.toHexString();
    const row: FoundNote = {
      noteId,
      title: doc.title,
      urlPath: `/${noteId}`,
      createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
      avgRating: doc.avgRating ?? 0,
      commentCount: doc.commentCount ?? 0,
    };
    if (wantYoutube) {
      const yt = extractYoutubeUrl(doc);
      if (yt) row.youtubeUrl = yt;
    }
    return row;
  });

  return {
    notes,
    filters: {
      sinceDays: args.sinceDays ?? null,
      linkHost: args.linkHost ?? null,
      sort: sortKey,
      limit,
    },
  };
}

/** Rank authors by number of published notes (Mongo — no Neo4j). */
export async function loadTopContributors(
  db: Db,
  limit = 10,
): Promise<TopContributor[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50);
  const rows = await collections
    .notes(db)
    .aggregate<{ _id: ObjectId; noteCount: number }>([
      {
        $match: {
          status: "published",
          authorId: { $ne: null },
        },
      },
      { $group: { _id: "$authorId", noteCount: { $sum: 1 } } },
      { $sort: { noteCount: -1 } },
      { $limit: safeLimit },
    ])
    .toArray();

  if (rows.length === 0) return [];

  const users = await loadUsersByIds(
    db,
    rows.map((r) => r._id.toHexString()),
  );

  return rows.map((r) => {
    const id = r._id.toHexString();
    const u = users.get(id);
    const name = u
      ? `${u.firstName} ${u.lastName}`.trim() || id
      : "Utilisateur supprimé";
    return { id, name, noteCount: r.noteCount };
  });
}
