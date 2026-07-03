import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/aws-lambda";
import { env } from "./lib/env.js";
import { onError, withDb, requireAuth, type AppEnv } from "./lib/http.js";
import { authRoutes } from "./routes/auth.js";
import { usersRoutes } from "./routes/users.js";
import { notesRoutes } from "./routes/notes.js";
import { commentsRoutes } from "./routes/comments.js";
import { votesRoutes } from "./routes/votes.js";
import { tagsRoutes } from "./routes/tags.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { uploadsRoutes } from "./routes/uploads.js";
import { ogRoutes } from "./routes/og.js";
import { statsRoutes } from "./routes/stats.js";

const app = new Hono<AppEnv>();

// CORS : `env.corsOrigins` est une liste. Hono traite un tableau en
// correspondance exacte → "*" n'y matche jamais une vraie origine. On gère donc
// le joker en reflétant l'origine de la requête (compatible avec credentials,
// contrairement au littéral "*").
const corsAllowAll = env.corsOrigins.includes("*");
app.use("*", cors({
  origin: (origin) =>
    corsAllowAll ? origin || "*" : env.corsOrigins.includes(origin) ? origin : null,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type"],
  credentials: true,
}));
app.use("*", withDb);
app.onError(onError);

app.get("/health", (c) => c.json({ ok: true }));

// Auth : public (login/refresh) + /me protégé en interne.
app.route("/auth", authRoutes);

// Routes protégées (toutes exigent un access token).
app.use("/users/*", requireAuth);
app.use("/notes/*", requireAuth);
app.use("/comments/*", requireAuth);
app.use("/votes/*", requireAuth);
app.use("/tags/*", requireAuth);
app.use("/notifications/*", requireAuth);
app.use("/uploads/*", requireAuth);
app.use("/og/*", requireAuth);
app.use("/stats/*", requireAuth);

app.route("/users", usersRoutes);
app.route("/notes", notesRoutes);
app.route("/comments", commentsRoutes);
app.route("/votes", votesRoutes);
app.route("/tags", tagsRoutes);
app.route("/notifications", notificationsRoutes);
app.route("/uploads", uploadsRoutes);
app.route("/og", ogRoutes);
app.route("/stats", statsRoutes);

export const handler = handle(app);
export { app };
