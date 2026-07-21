import { ragConfig } from "../config.js";
import { chunkText, htmlToText } from "../html.js";
import type { CatalogDocument, NoteSource } from "../types.js";
import { pointIdFor } from "../vector/qdrant.js";

function notePayload(note: NoteSource, chunkIndex: number) {
  return {
    noteId: note.id,
    title: note.title,
    tags: note.tags,
    chunkIndex,
    urlPath: `/${note.id}`,
    label: note.title,
    authorId: note.authorId,
    authorName: note.authorName,
    avgRating: note.avgRating,
    voteCount: note.voteCount,
    commentCount: note.commentCount,
  };
}

export function buildNoteDocuments(note: NoteSource): CatalogDocument[] {
  const body = htmlToText(note.contentHtml);
  const header = [
    `Note: ${note.title}`,
    note.authorName ? `Auteur: ${note.authorName}` : null,
    note.tags.length > 0 ? `Tags: ${note.tags.join(", ")}` : null,
    note.voteCount > 0
      ? `Note: ${note.avgRating}/5 (${note.voteCount} votes)`
      : null,
    note.commentCount > 0 ? `Commentaires: ${note.commentCount}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const fullText = body ? `${header}\n\n${body}` : header;
  const chunks = chunkText(fullText, ragConfig.chunkSize, ragConfig.chunkOverlap);
  if (chunks.length === 0) {
    return [
      {
        pointId: pointIdFor("note", `${note.id}:0`),
        type: "note",
        text: header,
        payload: notePayload(note, 0),
      },
    ];
  }

  return chunks.map((chunk, chunkIndex) => ({
    pointId: pointIdFor("note", `${note.id}:${chunkIndex}`),
    type: "note" as const,
    text: chunk,
    payload: notePayload(note, chunkIndex),
  }));
}
