import { Hono } from "hono";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { collections, type UserDoc } from "../lib/db.js";
import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from "../lib/auth.js";
import {
  body,
  currentUser,
  errors,
  oid,
  requireAdmin,
  type AppEnv,
} from "../lib/http.js";
import { toUserAdmin, toUserSelf } from "../models/index.js";
import { userStats } from "./auth.js";
import { createNotification } from "./notifications.js";

export const usersRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Schémas Zod
// ---------------------------------------------------------------------------

const roleSchema = z.enum(["user", "admin"]);
const statusSchema = z.enum(["active", "disabled"]);

const createUserSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email(),
  role: roleSchema,
});

const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    role: roleSchema.optional(),
    status: statusSchema.optional(),
  })
  .strict();

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** Échappe les métacaractères regex d'une recherche utilisateur. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Routes « moi » (utilisateur courant — PAS admin). Déclarées avant /:id.
// ---------------------------------------------------------------------------

// PUT /users/me/profile — l'utilisateur courant modifie prénom/nom/avatar.
usersRoutes.put("/me/profile", async (c) => {
  const db = c.get("db");
  const input = await body(c, updateProfileSchema);

  const set: Partial<UserDoc> = { updatedAt: new Date() };
  if (input.firstName !== undefined) set.firstName = input.firstName;
  if (input.lastName !== undefined) set.lastName = input.lastName;
  if (input.avatarUrl !== undefined) set.avatarUrl = input.avatarUrl;

  const updated = await collections.users(db).findOneAndUpdate(
    { _id: new ObjectId(c.get("userId")) },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!updated) throw errors.notFound("Utilisateur introuvable");

  const stats = await userStats(db, updated._id);
  return c.json(toUserSelf(updated, stats));
});

// PUT /users/me/password — change le mot de passe après vérification.
usersRoutes.put("/me/password", async (c) => {
  const db = c.get("db");
  const { currentPassword, newPassword } = await body(c, changePasswordSchema);

  const user = await currentUser(c);
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw errors.badRequest("Mot de passe actuel incorrect");

  const passwordHash = await hashPassword(newPassword);
  await collections.users(db).updateOne(
    { _id: user._id },
    { $set: { passwordHash, updatedAt: new Date() } },
  );
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Routes admin (CRUD utilisateurs).
// ---------------------------------------------------------------------------

// GET /users?q= — recherche nom/email, tri createdAt desc.
usersRoutes.get("/", requireAdmin, async (c) => {
  const db = c.get("db");
  const q = c.req.query("q")?.trim();

  const filter: Filter<UserDoc> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const docs = await collections
    .users(db)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return c.json({
    items: docs.map(toUserAdmin),
    nextCursor: null,
    total: docs.length,
  });
});

// POST /users — crée un utilisateur + mot de passe temporaire.
usersRoutes.post("/", requireAdmin, async (c) => {
  const db = c.get("db");
  const input = await body(c, createUserSchema);
  const email = input.email.toLowerCase();

  const exists = await collections.users(db).findOne({ email });
  if (exists) throw errors.conflict("E-mail déjà utilisé");

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const now = new Date();

  const doc: UserDoc = {
    _id: new ObjectId(),
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    passwordHash,
    role: input.role,
    status: "active",
    avatarUrl: null,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  await collections.users(db).insertOne(doc);

  await createNotification(
    db,
    doc._id,
    "account_created",
    "Votre compte NoteShare a été créé.",
  );

  return c.json({ user: toUserAdmin(doc), temporaryPassword });
});

// PUT /users/:id — modifie profil/role/status.
usersRoutes.put("/:id", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = oid(c.req.param("id"));
  const input = await body(c, updateUserSchema);

  const user = await collections.users(db).findOne({ _id: id });
  if (!user) throw errors.notFound("Utilisateur introuvable");

  const set: Partial<UserDoc> = { updatedAt: new Date() };
  if (input.firstName !== undefined) set.firstName = input.firstName;
  if (input.lastName !== undefined) set.lastName = input.lastName;
  if (input.role !== undefined) set.role = input.role;

  if (input.email !== undefined) {
    const email = input.email.toLowerCase();
    if (email !== user.email) {
      const clash = await collections.users(db).findOne({ email });
      if (clash) throw errors.conflict("E-mail déjà utilisé");
      set.email = email;
    }
  }

  const update: { $set: Partial<UserDoc>; $inc?: { tokenVersion: number } } = {
    $set: set,
  };
  if (input.status !== undefined) {
    set.status = input.status;
    // Désactiver coupe les sessions actives via tokenVersion.
    if (input.status === "disabled" && user.status !== "disabled") {
      update.$inc = { tokenVersion: 1 };
    }
  }

  const updated = await collections.users(db).findOneAndUpdate(
    { _id: id },
    update,
    { returnDocument: "after" },
  );
  if (!updated) throw errors.notFound("Utilisateur introuvable");

  await createNotification(
    db,
    updated._id,
    "account_updated",
    "Votre compte a été mis à jour par un administrateur.",
  );

  return c.json(toUserAdmin(updated));
});

// POST /users/:id/reset-password — nouveau mot de passe temporaire.
usersRoutes.post("/:id/reset-password", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = oid(c.req.param("id"));

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const updated = await collections.users(db).findOneAndUpdate(
    { _id: id },
    { $set: { passwordHash, updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw errors.notFound("Utilisateur introuvable");

  return c.json({ user: toUserAdmin(updated), temporaryPassword });
});

// DELETE /users/:id — suppression définitive ; notes/commentaires conservés.
usersRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = oid(c.req.param("id"));

  if (id.toHexString() === c.get("userId")) {
    throw errors.badRequest("Impossible de supprimer votre propre compte.");
  }

  const user = await collections.users(db).findOne({ _id: id });
  if (!user) throw errors.notFound("Utilisateur introuvable");

  // Anonymise l'auteur (→ « Utilisateur supprimé ») sans perdre le contenu.
  await Promise.all([
    collections.notes(db).updateMany({ authorId: id }, { $set: { authorId: null } }),
    collections.comments(db).updateMany({ authorId: id }, { $set: { authorId: null } }),
  ]);
  await collections.users(db).deleteOne({ _id: id });

  return c.body(null, 204);
});
