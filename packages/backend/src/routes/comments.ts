import { Hono } from "hono";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type { UserRole } from "@cinco-wiki/shared";
import { LIMITS } from "@cinco-wiki/shared";
import { collections, type CommentDoc, type NoteDoc } from "../lib/db.js";
import {
  body,
  currentUser,
  errors,
  oid,
  type AppEnv,
} from "../lib/http.js";
import { authorResolver } from "../lib/relations.js";
import { toComment, toUserPublic } from "../models/index.js";
import { createNotification } from "../routes/notifications.js";

export const commentsRoutes = new Hono<AppEnv>();

const commentSchema = z.object({
  text: z.string().trim().min(1, "Commentaire vide").max(LIMITS.commentMax),
});

/**
 * Applique la visibilité des brouillons (§notes) aux commentaires :
 * un brouillon n'est accessible qu'à son auteur ou à un admin.
 */
function assertNoteVisible(note: NoteDoc, userId: ObjectId, role: UserRole): void {
  const isOwner = note.authorId?.equals(userId) ?? false;
  if (note.status !== "published" && !isOwner && role !== "admin") {
    throw errors.notFound("Note introuvable");
  }
}

// GET /comments/:noteId — commentaires à plat, tri ancien→récent.
commentsRoutes.get("/:noteId", async (c) => {
  const noteId = oid(c.req.param("noteId"));
  const db = c.get("db");

  const note = await collections.notes(db).findOne({ _id: noteId });
  if (!note) throw errors.notFound("Note introuvable");
  assertNoteVisible(note, new ObjectId(c.get("userId")), c.get("role"));

  const docs = await collections
    .comments(db)
    .find({ noteId })
    .sort({ createdAt: 1 })
    .toArray();

  const resolve = await authorResolver(db, docs.map((d) => d.authorId));
  return c.json(docs.map((d) => toComment(d, resolve(d.authorId))));
});

// POST /comments/:noteId — ajoute un commentaire + notifie l'auteur de la note.
commentsRoutes.post("/:noteId", async (c) => {
  const noteId = oid(c.req.param("noteId"));
  const { text } = await body(c, commentSchema);
  const db = c.get("db");
  const user = await currentUser(c);

  const note = await collections.notes(db).findOne({ _id: noteId });
  if (!note) throw errors.notFound("Note introuvable");
  assertNoteVisible(note, user._id, c.get("role"));

  const now = new Date();
  const doc: CommentDoc = {
    _id: new ObjectId(),
    noteId,
    authorId: user._id,
    text,
    createdAt: now,
    updatedAt: now,
  };
  await collections.comments(db).insertOne(doc);
  await collections.notes(db).updateOne({ _id: noteId }, { $inc: { commentCount: 1 } });

  if (note.authorId && !note.authorId.equals(user._id)) {
    await createNotification(
      db,
      note.authorId,
      "comment_on_note",
      `${user.firstName} ${user.lastName} a commenté votre note « ${note.title} »`,
      noteId,
    );
  }

  return c.json(toComment(doc, toUserPublic(user)), 201);
});

// PUT /comments/item/:id — édition par l'auteur du commentaire uniquement.
commentsRoutes.put("/item/:id", async (c) => {
  const id = oid(c.req.param("id"));
  const { text } = await body(c, commentSchema);
  const db = c.get("db");
  const user = await currentUser(c);

  const comment = await collections.comments(db).findOne({ _id: id });
  if (!comment) throw errors.notFound("Commentaire introuvable");
  if (!comment.authorId || !comment.authorId.equals(user._id)) {
    throw errors.forbidden("Seul l'auteur peut modifier ce commentaire");
  }

  const updatedAt = new Date();
  await collections.comments(db).updateOne({ _id: id }, { $set: { text, updatedAt } });
  return c.json(toComment({ ...comment, text, updatedAt }, toUserPublic(user)));
});

// DELETE /comments/item/:id — auteur du commentaire, auteur de la note, ou admin.
commentsRoutes.delete("/item/:id", async (c) => {
  const id = oid(c.req.param("id"));
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  const role = c.get("role");

  const comment = await collections.comments(db).findOne({ _id: id });
  if (!comment) throw errors.notFound("Commentaire introuvable");

  const note = await collections.notes(db).findOne({ _id: comment.noteId });

  const isCommentAuthor = comment.authorId?.equals(userId) ?? false;
  const isNoteAuthor = note?.authorId?.equals(userId) ?? false;
  if (!isCommentAuthor && !isNoteAuthor && role !== "admin") {
    throw errors.forbidden("Suppression non autorisée");
  }

  await collections.comments(db).deleteOne({ _id: id });
  if (note) {
    await collections.notes(db).updateOne({ _id: note._id }, { $inc: { commentCount: -1 } });
  }
  return c.body(null, 204);
});
