import { Hono } from "hono";
import type { TopContributor } from "@cinco-wiki/shared";
import { collections, type UserDoc } from "../lib/db.js";
import { type AppEnv } from "../lib/http.js";
import { toUserPublic } from "../models/index.js";
import { userStats } from "./auth.js";

export const statsRoutes = new Hono<AppEnv>();

/** GET /stats/top-contributor — auteur avec le plus de notes publiées. */
statsRoutes.get("/top-contributor", async (c) => {
  const db = c.get("db");

  const [top] = await collections
    .notes(db)
    .aggregate<{ _id: UserDoc["_id"]; user: UserDoc }>([
      { $match: { authorId: { $ne: null }, status: "published" } },
      { $group: { _id: "$authorId", notesCount: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $match: { "user.status": "active" } },
      { $sort: { notesCount: -1 } },
      { $limit: 1 },
    ])
    .toArray();

  if (!top) return c.json(null);

  const stats = await userStats(db, top.user._id);
  const result: TopContributor = {
    user: toUserPublic(top.user),
    stats,
  };
  return c.json(result);
});
