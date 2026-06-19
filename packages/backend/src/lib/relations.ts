import { ObjectId, type Db } from "mongodb";
import type { UserPublic } from "@noteshare/shared";
import { collections } from "./db.js";
import { DELETED_USER, toUserPublic } from "../models/index.js";

/**
 * Charge en une requête les profils publics d'un lot d'auteurs.
 * Renvoie une fonction de résolution tolérante aux ids null (compte supprimé).
 */
export async function authorResolver(
  db: Db,
  authorIds: (ObjectId | null)[],
): Promise<(id: ObjectId | null) => UserPublic> {
  const ids = authorIds.filter((x): x is ObjectId => x !== null);
  const docs = ids.length
    ? await collections.users(db).find({ _id: { $in: ids } }).toArray()
    : [];
  const map = new Map(docs.map((d) => [d._id.toHexString(), toUserPublic(d)]));
  return (id) => (id ? (map.get(id.toHexString()) ?? DELETED_USER) : DELETED_USER);
}
