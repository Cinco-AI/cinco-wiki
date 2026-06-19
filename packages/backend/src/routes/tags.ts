import { Hono } from "hono";
import type { Db } from "mongodb";
import { z } from "zod";
import type { Tag } from "@noteshare/shared";
import { normalizeTag } from "@noteshare/shared";
import { collections } from "../lib/db.js";
import { body, errors, requireAdmin, type AppEnv } from "../lib/http.js";

export const tagsRoutes = new Hono<AppEnv>();

const mergeSchema = z.object({
  from: z.string().min(1),
  into: z.string().min(1),
});

const renameSchema = z.object({
  to: z.string().min(1),
});

/** 404 si le tag n'existe ni dans la collection tags ni sur une note. */
async function assertTagExists(db: Db, name: string): Promise<void> {
  const tag = await collections.tags(db).findOne({ name });
  if (tag) return;
  const note = await collections.notes(db).findOne({ tags: name }, { projection: { _id: 1 } });
  if (!note) throw errors.notFound("Tag introuvable");
}

/**
 * Fusionne `from` dans `into` : déplace le tag sur toutes les notes (en évitant
 * les doublons), recalcule le compteur dénormalisé de `into` et supprime `from`.
 */
async function mergeInto(db: Db, from: string, into: string): Promise<void> {
  const notes = collections.notes(db);
  const tags = collections.tags(db);
  const now = new Date();

  // Notes possédant `from` mais pas encore `into` → on y déplacera le tag.
  const toRename = (
    await notes
      .find({ tags: { $eq: from, $ne: into } }, { projection: { _id: 1 } })
      .toArray()
  ).map((d) => d._id);

  // Notes possédant déjà les deux tags → on retire simplement `from`.
  await notes.updateMany(
    { tags: { $all: [from, into] } },
    { $pull: { tags: from }, $set: { updatedAt: now } },
  );

  // Renommage : retirer `from` puis ajouter `into` (deux étapes, même champ).
  if (toRename.length) {
    await notes.updateMany(
      { _id: { $in: toRename } },
      { $pull: { tags: from }, $set: { updatedAt: now } },
    );
    await notes.updateMany({ _id: { $in: toRename } }, { $addToSet: { tags: into } });
  }

  // Compteur dénormalisé fusionné = nombre de notes portant `into`.
  const count = await notes.countDocuments({ tags: into });
  await tags.updateOne({ name: into }, { $set: { name: into, count } }, { upsert: true });
  await tags.deleteOne({ name: from });
}

// GET /tags — tous les tags actifs, triés par fréquence décroissante.
tagsRoutes.get("/", async (c) => {
  const db = c.get("db");
  const docs = await collections
    .tags(db)
    .find({ count: { $gt: 0 } })
    .sort({ count: -1, name: 1 })
    .toArray();
  const result: Tag[] = docs.map((t) => ({ name: t.name, count: t.count }));
  return c.json(result);
});

// POST /tags/merge — fusion de deux tags (admin).
tagsRoutes.post("/merge", requireAdmin, async (c) => {
  const { from, into } = await body(c, mergeSchema);
  const fromTag = normalizeTag(from);
  const intoTag = normalizeTag(into);
  if (!fromTag || !intoTag) throw errors.badRequest("Tag vide");
  if (fromTag === intoTag) throw errors.badRequest("Les tags source et cible sont identiques");

  const db = c.get("db");
  await assertTagExists(db, fromTag);
  await mergeInto(db, fromTag, intoTag);
  return c.body(null, 204);
});

// PUT /tags/:name — renommage d'un tag partout (admin).
tagsRoutes.put("/:name", requireAdmin, async (c) => {
  const { to } = await body(c, renameSchema);
  const from = normalizeTag(c.req.param("name"));
  const into = normalizeTag(to);
  if (!from || !into) throw errors.badRequest("Tag vide");

  const db = c.get("db");
  await assertTagExists(db, from);
  if (from === into) return c.body(null, 204);
  await mergeInto(db, from, into);
  return c.body(null, 204);
});

// DELETE /tags/:name — retrait d'un tag de toutes les notes (admin).
tagsRoutes.delete("/:name", requireAdmin, async (c) => {
  const name = normalizeTag(c.req.param("name"));
  if (!name) throw errors.badRequest("Tag vide");

  const db = c.get("db");
  await assertTagExists(db, name);
  await collections
    .notes(db)
    .updateMany({ tags: name }, { $pull: { tags: name }, $set: { updatedAt: new Date() } });
  await collections.tags(db).deleteOne({ name });
  return c.body(null, 204);
});
