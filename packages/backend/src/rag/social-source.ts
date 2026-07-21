import { ObjectId, type Db } from "mongodb";
import { collections } from "../lib/db.js";

export type GraphUser = {
  id: string;
  firstName: string;
  lastName: string;
};

export type GraphVote = {
  noteId: string;
  userId: string;
  value: number;
  updatedAt: Date;
};

export type GraphComment = {
  id: string;
  noteId: string;
  authorId: string | null;
  textPreview: string;
  createdAt: Date;
  reactions: Array<{ emoji: string; userIds: string[] }>;
};

function previewText(text: string, max = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function loadUsersByIds(
  db: Db,
  ids: string[],
): Promise<Map<string, GraphUser>> {
  const unique = [...new Set(ids.filter((id) => ObjectId.isValid(id)))];
  const map = new Map<string, GraphUser>();
  if (unique.length === 0) return map;

  const docs = await collections
    .users(db)
    .find({ _id: { $in: unique.map((id) => new ObjectId(id)) } })
    .project({ firstName: 1, lastName: 1 })
    .toArray();

  for (const d of docs) {
    map.set(d._id.toHexString(), {
      id: d._id.toHexString(),
      firstName: d.firstName,
      lastName: d.lastName,
    });
  }
  return map;
}

export async function loadVotesForNotes(
  db: Db,
  noteIds: string[],
): Promise<GraphVote[]> {
  const oids = noteIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (oids.length === 0) return [];

  const docs = await collections
    .votes(db)
    .find({ noteId: { $in: oids } })
    .toArray();

  return docs.map((d) => ({
    noteId: d.noteId.toHexString(),
    userId: d.userId.toHexString(),
    value: d.value,
    updatedAt: d.updatedAt,
  }));
}

export async function loadCommentsForNotes(
  db: Db,
  noteIds: string[],
): Promise<GraphComment[]> {
  const oids = noteIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (oids.length === 0) return [];

  const docs = await collections
    .comments(db)
    .find({ noteId: { $in: oids } })
    .toArray();

  return docs.map((d) => ({
    id: d._id.toHexString(),
    noteId: d.noteId.toHexString(),
    authorId: d.authorId ? d.authorId.toHexString() : null,
    textPreview: previewText(d.text),
    createdAt: d.createdAt,
    reactions: (d.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      userIds: r.userIds.map((id) => id.toHexString()),
    })),
  }));
}

export function collectUserIds(args: {
  authorIds: Array<string | null | undefined>;
  votes: GraphVote[];
  comments: GraphComment[];
}): string[] {
  const ids = new Set<string>();
  for (const a of args.authorIds) {
    if (a) ids.add(a);
  }
  for (const v of args.votes) ids.add(v.userId);
  for (const c of args.comments) {
    if (c.authorId) ids.add(c.authorId);
    for (const r of c.reactions) {
      for (const uid of r.userIds) ids.add(uid);
    }
  }
  return [...ids];
}
