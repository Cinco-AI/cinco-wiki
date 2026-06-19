import { Hono } from "hono";
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import type { Note } from "@noteshare/shared";
import { LIMITS } from "@noteshare/shared";
import { collections } from "../lib/db.js";
import {
  body,
  currentUser,
  errors,
  oid,
  type AppEnv,
} from "../lib/http.js";
import { authorResolver } from "../lib/relations.js";
import { toNote } from "../models/index.js";
import { createNotification } from "../routes/notifications.js";

export const votesRoutes = new Hono<AppEnv>();

const voteSchema = z.object({
  value: z.number().int().min(LIMITS.voteMin).max(LIMITS.voteMax),
});

/**
 * Recalcule les compteurs dénormalisés `avgRating`/`voteCount` de la note à
 * partir de la collection `votes`, persiste, puis renvoie le DTO `Note` complet
 * (avec `myVote` du votant courant).
 */
async function recalcAndBuild(db: Db, noteId: ObjectId, userId: ObjectId): Promise<Note> {
  const agg = await collections
    .votes(db)
    .aggregate<{ avg: number; count: number }>([
      { $match: { noteId } },
      { $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const stats = agg[0];
  const avgRating = stats ? Math.round(stats.avg * 10) / 10 : 0;
  const voteCount = stats ? stats.count : 0;

  await collections.notes(db).updateOne({ _id: noteId }, { $set: { avgRating, voteCount } });

  const note = await collections.notes(db).findOne({ _id: noteId });
  if (!note) throw errors.notFound("Note introuvable");

  const resolve = await authorResolver(db, [note.authorId]);
  const myVote = await collections.votes(db).findOne({ noteId, userId });
  return toNote(note, resolve(note.authorId), myVote?.value ?? null);
}

// PUT /votes/:noteId — pose / met à jour le vote (1 vote/user/note), recalcule.
votesRoutes.put("/:noteId", async (c) => {
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  const noteId = oid(c.req.param("noteId"));
  const { value } = await body(c, voteSchema);

  const note = await collections.notes(db).findOne({ _id: noteId });
  if (!note) throw errors.notFound("Note introuvable");
  if (note.status !== "published") {
    throw errors.forbidden("Vote possible uniquement sur une note publiée");
  }

  const now = new Date();
  await collections.votes(db).updateOne(
    { noteId, userId },
    { $set: { value, updatedAt: now }, $setOnInsert: { noteId, userId, createdAt: now } },
    { upsert: true },
  );

  // Notif à l'auteur (si auteur existant et ≠ votant).
  if (note.authorId && !note.authorId.equals(userId)) {
    const voter = await currentUser(c);
    await createNotification(
      db,
      note.authorId,
      "vote_on_note",
      `${voter.firstName} ${voter.lastName} a attribué la note ${value}/5 à « ${note.title} »`,
      noteId,
    );
  }

  return c.json(await recalcAndBuild(db, noteId, userId));
});

// DELETE /votes/:noteId — retire le vote du courant, recalcule.
votesRoutes.delete("/:noteId", async (c) => {
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  const noteId = oid(c.req.param("noteId"));

  const note = await collections.notes(db).findOne({ _id: noteId });
  if (!note) throw errors.notFound("Note introuvable");

  await collections.votes(db).deleteOne({ noteId, userId });

  return c.json(await recalcAndBuild(db, noteId, userId));
});
