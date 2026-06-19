import type { Context, MiddlewareHandler } from "hono";
import { ObjectId, type Db } from "mongodb";
import { ZodError, type ZodSchema } from "zod";
import type { UserRole } from "@noteshare/shared";
import { getDb, collections, type UserDoc } from "./db.js";
import { verifyAccessToken } from "./auth.js";

/** Variables injectées dans le contexte Hono par les middlewares. */
export type AppEnv = {
  Variables: {
    db: Db;
    userId: string;
    role: UserRole;
  };
};

export type AppContext = Context<AppEnv>;

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: (msg = "Authentification requise") =>
    new HttpError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Accès refusé") => new HttpError(403, "FORBIDDEN", msg),
  notFound: (msg = "Ressource introuvable") => new HttpError(404, "NOT_FOUND", msg),
  badRequest: (msg = "Requête invalide", details?: unknown) =>
    new HttpError(400, "BAD_REQUEST", msg, details),
  conflict: (msg = "Conflit") => new HttpError(409, "CONFLICT", msg),
};

/** Convertit une erreur en réponse JSON normalisée (cf. ApiError). */
export function onError(err: Error, c: Context) {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, code: err.code, details: err.details }, err.status as never);
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: "Données invalides", code: "VALIDATION", details: err.flatten() },
      400,
    );
  }
  console.error("Erreur non gérée:", err);
  return c.json({ error: "Erreur interne", code: "INTERNAL" }, 500);
}

/** Parse + valide le corps JSON via un schéma Zod. */
export async function body<T>(c: Context, schema: ZodSchema<T>): Promise<T> {
  const raw = await c.req.json().catch(() => {
    throw errors.badRequest("Corps JSON invalide");
  });
  return schema.parse(raw);
}

/** Injecte la connexion DB dans le contexte. À monter en premier. */
export const withDb: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("db", await getDb());
  await next();
};

/** Exige un access token valide + un compte actif. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw errors.unauthorized();

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw errors.unauthorized("Token invalide ou expiré");
  }

  const db = c.get("db");
  const user = await collections.users(db).findOne({ _id: new ObjectId(claims.sub) });
  if (!user || user.status !== "active") throw errors.unauthorized("Compte inactif");

  c.set("userId", claims.sub);
  c.set("role", user.role);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("role") !== "admin") throw errors.forbidden("Réservé à l'administrateur");
  await next();
};

/** Charge le UserDoc courant (après requireAuth). */
export async function currentUser(c: AppContext): Promise<UserDoc> {
  const db = c.get("db");
  const user = await collections.users(db).findOne({ _id: new ObjectId(c.get("userId")) });
  if (!user) throw errors.unauthorized();
  return user;
}

/** Parse un ObjectId de paramètre d'URL ou 404. */
export function oid(value: string | undefined): ObjectId {
  if (!value || !ObjectId.isValid(value)) throw errors.notFound();
  return new ObjectId(value);
}
