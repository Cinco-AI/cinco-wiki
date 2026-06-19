import { Hono } from "hono";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "../lib/db.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "../lib/auth.js";
import {
  body,
  currentUser,
  errors,
  requireAuth,
  type AppEnv,
} from "../lib/http.js";
import { toUserSelf } from "../models/index.js";

export const authRoutes = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

/** Statistiques de profil (§3.3) : notes, commentaires, votes. */
async function userStats(db: Awaited<ReturnType<typeof import("../lib/db.js").getDb>>, id: ObjectId) {
  const [notesCount, commentsCount, votesCount] = await Promise.all([
    collections.notes(db).countDocuments({ authorId: id }),
    collections.comments(db).countDocuments({ authorId: id }),
    collections.votes(db).countDocuments({ userId: id }),
  ]);
  return { notesCount, commentsCount, votesCount };
}

// POST /auth/login — message d'erreur générique (§3.1).
authRoutes.post("/login", async (c) => {
  const { email, password, rememberMe } = await body(c, loginSchema);
  const db = c.get("db");
  const user = await collections.users(db).findOne({ email: email.toLowerCase() });

  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) throw errors.unauthorized("E-mail ou mot de passe incorrect");
  if (user.status !== "active") throw errors.forbidden("Compte désactivé");

  const id = user._id.toHexString();
  const [accessToken, refreshToken, stats] = await Promise.all([
    signAccessToken(id, user.role),
    signRefreshToken(id, user.tokenVersion, rememberMe),
    userStats(db, user._id),
  ]);
  return c.json({ accessToken, refreshToken, user: toUserSelf(user, stats) });
});

// POST /auth/refresh — rotation de l'access token.
authRoutes.post("/refresh", async (c) => {
  const { refreshToken } = await body(c, z.object({ refreshToken: z.string() }));
  let claims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch {
    throw errors.unauthorized("Refresh token invalide");
  }
  const db = c.get("db");
  const user = await collections.users(db).findOne({ _id: new ObjectId(claims.sub) });
  if (!user || user.status !== "active" || user.tokenVersion !== claims.ver) {
    throw errors.unauthorized("Session expirée");
  }
  const id = user._id.toHexString();
  const [accessToken, newRefresh, stats] = await Promise.all([
    signAccessToken(id, user.role),
    signRefreshToken(id, user.tokenVersion),
    userStats(db, user._id),
  ]);
  return c.json({ accessToken, refreshToken: newRefresh, user: toUserSelf(user, stats) });
});

// GET /auth/me — utilisateur courant + stats.
authRoutes.get("/me", requireAuth, async (c) => {
  const user = await currentUser(c);
  const stats = await userStats(c.get("db"), user._id);
  return c.json(toUserSelf(user, stats));
});

export { userStats };
