import { Hono } from "hono";
import { ObjectId, type Db, type Filter, type Sort } from "mongodb";
import { z } from "zod";
import type {
  LinkPreview,
  Note,
  NoteCard,
  NoteSort,
  Paginated,
} from "@cinco-wiki/shared";
import { LIMITS, normalizeTag } from "@cinco-wiki/shared";
import { collections, type NoteDoc } from "../lib/db.js";
import { body, errors, oid, type AppEnv } from "../lib/http.js";
import { authorResolver } from "../lib/relations.js";
import { sanitizeContent } from "../lib/sanitize.js";
import { toNote, toNoteCard } from "../models/index.js";
import { composeContentHtml, preserveContentHtmlPrefix } from "../lib/content-html.js";
import { summarizeExternalLink } from "../lib/link-summarizer-client.js";
import { createNotification } from "../routes/notifications.js";
import { fetchOgPreview } from "../routes/og.js";

export const notesRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Schémas de validation (Zod)
// ---------------------------------------------------------------------------

const imageSchema = z.object({
  url: z.string().url(),
  order: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  contentType: z.string().min(1).max(255),
});

const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.noteTitleMax),
  contentHtml: z.string(),
  tags: z.array(z.string()),
  images: z.array(imageSchema),
  attachments: z.array(attachmentSchema),
  links: z.array(z.string().url()),
  status: z.enum(["published", "draft"]),
});

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["recent", "oldest", "top_rated", "most_commented"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Tri + pagination par curseur (keyset : valeur de tri + _id en départage)
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 24;

const SORT_CONFIG: Record<NoteSort, { field: keyof NoteDoc; dir: 1 | -1 }> = {
  recent: { field: "createdAt", dir: -1 },
  oldest: { field: "createdAt", dir: 1 },
  top_rated: { field: "avgRating", dir: -1 },
  most_commented: { field: "commentCount", dir: -1 },
};

function encodeCursor(value: unknown, id: ObjectId): string {
  return Buffer.from(JSON.stringify({ v: value, id: id.toHexString() })).toString("base64url");
}

function decodeCursor(raw: string | undefined): { v: unknown; id: ObjectId } | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      v: unknown;
      id?: string;
    };
    if (!obj || typeof obj.id !== "string" || !ObjectId.isValid(obj.id)) return null;
    return { v: obj.v, id: new ObjectId(obj.id) };
  } catch {
    return null;
  }
}

function cursorClause(
  field: keyof NoteDoc,
  dir: 1 | -1,
  cursor: { v: unknown; id: ObjectId },
): Filter<NoteDoc> {
  const value = field === "createdAt" ? new Date(cursor.v as string) : (cursor.v as number);
  const op = dir === -1 ? "$lt" : "$gt";
  return {
    $or: [
      { [field]: { [op]: value } },
      { [field]: value, _id: { [op]: cursor.id } },
    ],
  } as Filter<NoteDoc>;
}

// ---------------------------------------------------------------------------
// Helpers métier
// ---------------------------------------------------------------------------

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalise une liste de tags (minuscule, trim, dédup) et vérifie la limite. */
function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const name = normalizeTag(tag);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  if (out.length > LIMITS.tagsPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.tagsPerNote} tags par note`);
  }
  return out;
}

/** Met à jour les compteurs dénormalisés de tags (+1 / -1, upsert). */
async function adjustTagCounts(db: Db, tags: string[], delta: number): Promise<void> {
  if (!tags.length) return;
  await Promise.all(
    tags.map((name) =>
      collections.tags(db).updateOne({ name }, { $inc: { count: delta } }, { upsert: true }),
    ),
  );
  if (delta < 0) {
    await collections.tags(db).deleteMany({ name: { $in: tags }, count: { $lte: 0 } });
  }
}

/** Résout les URLs en aperçus Open Graph (réutilise og.ts), borné par la limite. */
async function resolveLinks(urls: string[]): Promise<LinkPreview[]> {
  if (urls.length > LIMITS.linksPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.linksPerNote} liens par note`);
  }
  return Promise.all(urls.map((url) => fetchOgPreview(url)));
}

async function myVoteValue(db: Db, noteId: ObjectId, userId: ObjectId): Promise<number | null> {
  const vote = await collections.votes(db).findOne({ noteId, userId });
  return vote?.value ?? null;
}

function canEditNote(note: NoteDoc, meId: ObjectId, isAdmin: boolean): boolean {
  return isAdmin || (note.authorId != null && note.authorId.equals(meId));
}

// ---------------------------------------------------------------------------
// GET /notes — liste filtrée / paginée par curseur
// ---------------------------------------------------------------------------

notesRoutes.get("/", async (c) => {
  const db = c.get("db");
  const meId = new ObjectId(c.get("userId"));

  const parsed = listQuerySchema.parse({
    q: c.req.query("q") || undefined,
    tags: c.req.queries("tags"),
    authorId: c.req.query("authorId"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    sort: c.req.query("sort"),
    mine: c.req.query("mine"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const mine = parsed.mine === "true";
  const sort = parsed.sort ?? "recent";
  const limit = parsed.limit ?? DEFAULT_LIMIT;
  const { field, dir } = SORT_CONFIG[sort];

  const conditions: Filter<NoteDoc>[] = [];

  // Visibilité : mine => toutes mes notes (brouillons inclus) ; sinon publiées.
  if (mine) {
    conditions.push({ authorId: meId });
  } else {
    conditions.push({ status: "published" });
    if (parsed.authorId) {
      if (!ObjectId.isValid(parsed.authorId)) throw errors.badRequest("authorId invalide");
      conditions.push({ authorId: new ObjectId(parsed.authorId) });
    }
  }

  // Recherche plein texte (titre + texte brut), regex insensible à la casse.
  if (parsed.q) {
    const rx = new RegExp(escapeRegex(parsed.q), "i");
    conditions.push({ $or: [{ title: rx }, { contentHtml: rx }] });
  }

  // Filtre tags (ET logique).
  if (parsed.tags?.length) {
    const tags = normalizeTags(parsed.tags);
    if (tags.length) conditions.push({ tags: { $all: tags } });
  }

  // Plage de dates sur createdAt.
  if (parsed.dateFrom || parsed.dateTo) {
    const range: Record<string, Date> = {};
    if (parsed.dateFrom) {
      const d = new Date(parsed.dateFrom);
      if (Number.isNaN(d.getTime())) throw errors.badRequest("dateFrom invalide");
      range.$gte = d;
    }
    if (parsed.dateTo) {
      const d = new Date(parsed.dateTo);
      if (Number.isNaN(d.getTime())) throw errors.badRequest("dateTo invalide");
      range.$lte = d;
    }
    conditions.push({ createdAt: range });
  }

  // Curseur (keyset).
  const cursor = decodeCursor(parsed.cursor);
  if (cursor) conditions.push(cursorClause(field, dir, cursor));

  const filter: Filter<NoteDoc> = conditions.length ? { $and: conditions } : {};
  const sortSpec: Sort = { [field]: dir, _id: dir };

  const docs = await collections
    .notes(db)
    .find(filter)
    .sort(sortSpec)
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  const resolve = await authorResolver(db, items.map((d) => d.authorId));
  const cards: NoteCard[] = items.map((d) => toNoteCard(d, resolve(d.authorId)));

  let nextCursor: string | null = null;
  const last = items.at(-1);
  if (hasMore && last) {
    nextCursor = encodeCursor((last as Record<string, unknown>)[field as string], last._id);
  }

  return c.json({ items: cards, nextCursor } satisfies Paginated<NoteCard>);
});

// ---------------------------------------------------------------------------
// GET /notes/:id — note complète (+ myVote)
// ---------------------------------------------------------------------------

notesRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const meId = new ObjectId(c.get("userId"));
  const isAdmin = c.get("role") === "admin";
  const id = oid(c.req.param("id"));

  const note = await collections.notes(db).findOne({ _id: id });
  if (!note) throw errors.notFound();

  // Brouillon : visible seulement par l'auteur ou un admin (404 sinon, sans fuite).
  if (note.status === "draft" && !canEditNote(note, meId, isAdmin)) {
    throw errors.notFound();
  }

  const resolve = await authorResolver(db, [note.authorId]);
  const myVote = await myVoteValue(db, id, meId);
  return c.json(toNote(note, resolve(note.authorId), myVote) satisfies Note);
});

// ---------------------------------------------------------------------------
// POST /notes — création
// ---------------------------------------------------------------------------

notesRoutes.post("/", async (c) => {
  const db = c.get("db");
  const meId = new ObjectId(c.get("userId"));
  const input = await body(c, noteInputSchema);

  if (input.images.length > LIMITS.imagesPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.imagesPerNote} images par note`);
  }
  if (input.attachments.length > LIMITS.attachmentsPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.attachmentsPerNote} documents par note`);
  }

  const tags = normalizeTags(input.tags);
  const links = await resolveLinks(input.links);
  const images = [...input.images].sort((a, b) => a.order - b.order);
  const attachments = input.attachments;
  const bodyHtml = sanitizeContent(input.contentHtml);

  let contentHtml = bodyHtml;
  let linkSummaryFailed = false;
  const firstLink = links[0];
  if (firstLink) {
    const { summary, error } = await summarizeExternalLink({
      url: firstLink.url,
      ogTitle: firstLink.title,
      ogDescription: firstLink.description,
    });
    if (summary) {
      contentHtml = composeContentHtml(bodyHtml, summary);
    } else {
      linkSummaryFailed = true;
      console.warn("link summary failed:", error);
    }
  }

  const now = new Date();
  const doc: NoteDoc = {
    _id: new ObjectId(),
    title: input.title,
    contentHtml,
    authorId: meId,
    tags,
    images,
    attachments,
    links,
    status: input.status,
    avgRating: 0,
    voteCount: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await collections.notes(db).insertOne(doc);
  await adjustTagCounts(db, tags, 1);

  if (linkSummaryFailed) {
    await createNotification(
      db,
      meId,
      "link_summary_failed",
      `Le résumé automatique du lien externe n'a pas pu être généré pour votre note « ${input.title} ».`,
      doc._id,
    );
  }

  const resolve = await authorResolver(db, [doc.authorId]);
  return c.json(toNote(doc, resolve(doc.authorId), null) satisfies Note, 201);
});

// ---------------------------------------------------------------------------
// PUT /notes/:id — mise à jour (auteur ou admin)
// ---------------------------------------------------------------------------

notesRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const meId = new ObjectId(c.get("userId"));
  const isAdmin = c.get("role") === "admin";
  const id = oid(c.req.param("id"));

  const note = await collections.notes(db).findOne({ _id: id });
  if (!note) throw errors.notFound();
  if (!canEditNote(note, meId, isAdmin)) throw errors.forbidden();

  const input = await body(c, noteInputSchema);
  if (input.images.length > LIMITS.imagesPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.imagesPerNote} images par note`);
  }
  if (input.attachments.length > LIMITS.attachmentsPerNote) {
    throw errors.badRequest(`Maximum ${LIMITS.attachmentsPerNote} documents par note`);
  }

  const tags = normalizeTags(input.tags);
  const links = await resolveLinks(input.links);
  const images = [...input.images].sort((a, b) => a.order - b.order);
  const attachments = input.attachments;
  const sanitizedBody = sanitizeContent(input.contentHtml);
  const contentHtml = preserveContentHtmlPrefix(note.contentHtml, sanitizedBody);
  const now = new Date();

  await collections.notes(db).updateOne(
    { _id: id },
    {
      $set: {
        title: input.title,
        contentHtml,
        tags,
        images,
        attachments,
        links,
        status: input.status,
        updatedAt: now,
      },
    },
  );

  // Ajuste les compteurs : retire les tags disparus, ajoute les nouveaux.
  const removed = note.tags.filter((t) => !tags.includes(t));
  const added = tags.filter((t) => !note.tags.includes(t));
  await adjustTagCounts(db, added, 1);
  await adjustTagCounts(db, removed, -1);

  const updated: NoteDoc = {
    ...note,
    title: input.title,
    contentHtml,
    tags,
    images,
    attachments,
    links,
    status: input.status,
    updatedAt: now,
  };

  const resolve = await authorResolver(db, [updated.authorId]);
  const myVote = await myVoteValue(db, id, meId);
  return c.json(toNote(updated, resolve(updated.authorId), myVote) satisfies Note);
});

// ---------------------------------------------------------------------------
// DELETE /notes/:id — suppression (auteur ou admin)
// ---------------------------------------------------------------------------

notesRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const meId = new ObjectId(c.get("userId"));
  const isAdmin = c.get("role") === "admin";
  const id = oid(c.req.param("id"));

  const note = await collections.notes(db).findOne({ _id: id });
  if (!note) throw errors.notFound();
  if (!canEditNote(note, meId, isAdmin)) throw errors.forbidden();

  await Promise.all([
    collections.votes(db).deleteMany({ noteId: id }),
    collections.comments(db).deleteMany({ noteId: id }),
  ]);
  await adjustTagCounts(db, note.tags, -1);
  await collections.notes(db).deleteOne({ _id: id });

  return c.body(null, 204);
});
