import { Hono } from "hono";
import { ObjectId, type Db } from "mongodb";
import type { NotificationType } from "@noteshare/shared";
import { collections, type NotificationDoc } from "../lib/db.js";
import { errors, oid, type AppEnv } from "../lib/http.js";
import { toNotification } from "../models/index.js";

export const notificationsRoutes = new Hono<AppEnv>();

// GET /notifications — notifications du destinataire courant, récentes d'abord.
notificationsRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  const docs = await collections
    .notifications(db)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return c.json(docs.map(toNotification));
});

// POST /notifications/read-all — marque toutes les notifications comme lues.
notificationsRoutes.post("/read-all", async (c) => {
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  await collections
    .notifications(db)
    .updateMany({ userId, read: false }, { $set: { read: true } });
  return c.body(null, 204);
});

// POST /notifications/:id/read — marque une notification du courant comme lue.
notificationsRoutes.post("/:id/read", async (c) => {
  const db = c.get("db");
  const userId = new ObjectId(c.get("userId"));
  const res = await collections
    .notifications(db)
    .updateOne({ _id: oid(c.req.param("id")), userId }, { $set: { read: true } });
  if (res.matchedCount === 0) throw errors.notFound();
  return c.body(null, 204);
});

/**
 * Crée une notification pour `userId` (destinataire). Réutilisé par les autres
 * routes (users/notes/votes/comments) qui l'importent.
 */
export async function createNotification(
  db: Db,
  userId: ObjectId | string,
  type: NotificationType,
  message: string,
  noteId: ObjectId | string | null = null,
): Promise<void> {
  const doc: NotificationDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    type,
    message,
    noteId: noteId ? new ObjectId(noteId) : null,
    read: false,
    createdAt: new Date(),
  };
  await collections.notifications(db).insertOne(doc);
}
