import type { Db } from "mongodb";
import type { NoteSource } from "../types.js";
import { upsertNoteSocialGraph, upsertSocialGraph } from "./social-upsert.js";

export { deleteNoteGraph } from "./social-upsert.js";

/** Upsert one note structure + social edges (requires Db for votes/comments). */
export async function upsertNoteGraph(db: Db, note: NoteSource): Promise<void> {
  await upsertNoteSocialGraph(db, note);
}

export async function upsertNotesGraph(
  db: Db,
  notes: NoteSource[],
): Promise<{ notes: number }> {
  const result = await upsertSocialGraph(db, notes);
  return { notes: result.notes };
}
