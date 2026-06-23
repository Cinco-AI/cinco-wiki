import type {
  Comment,
  Note,
  NoteCard,
  Notification,
  UserAdmin,
  UserPublic,
  UserSelf,
} from "@cinco-wiki/shared";
import { buildExcerpt } from "@cinco-wiki/shared";
import { ObjectId } from "mongodb";
import type {
  CommentDoc,
  NoteDoc,
  NotificationDoc,
  UserDoc,
} from "../lib/db.js";
import { htmlToText } from "../lib/sanitize.js";

/** Placeholder pour les notes/commentaires d'un compte supprimé (§12). */
export const DELETED_USER: UserPublic = {
  id: "deleted",
  firstName: "Utilisateur",
  lastName: "supprimé",
  avatarUrl: null,
};

export function toUserPublic(doc: UserDoc | null | undefined): UserPublic {
  if (!doc) return DELETED_USER;
  return {
    id: doc._id.toHexString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    avatarUrl: doc.avatarUrl,
  };
}

export function toUserAdmin(doc: UserDoc): UserAdmin {
  return {
    ...toUserPublic(doc),
    email: doc.email,
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toUserSelf(
  doc: UserDoc,
  stats: UserSelf["stats"],
): UserSelf {
  return { ...toUserAdmin(doc), stats };
}

export function toNote(doc: NoteDoc, author: UserPublic, myVote: number | null): Note {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    contentHtml: doc.contentHtml,
    author,
    tags: doc.tags,
    images: doc.images,
    attachments: doc.attachments ?? [],
    links: doc.links,
    status: doc.status,
    avgRating: doc.avgRating,
    voteCount: doc.voteCount,
    commentCount: doc.commentCount,
    myVote,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toNoteCard(doc: NoteDoc, author: UserPublic): NoteCard {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    excerpt: buildExcerpt(htmlToText(doc.contentHtml)),
    author,
    tags: doc.tags,
    firstImage: doc.images[0]?.url ?? null,
    firstLink: doc.links[0] ?? null,
    avgRating: doc.avgRating,
    voteCount: doc.voteCount,
    commentCount: doc.commentCount,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toComment(
  doc: CommentDoc,
  author: UserPublic,
  viewerId?: string,
  resolveUser?: (id: ObjectId) => UserPublic,
): Comment {
  const resolve = resolveUser ?? (() => DELETED_USER);
  const reactions = (doc.reactions ?? [])
    .filter((r) => r.userIds.length > 0)
    .map((r) => ({
      emoji: r.emoji,
      count: r.userIds.length,
      reacted: viewerId ? r.userIds.some((id) => id.toHexString() === viewerId) : false,
      users: r.userIds.map((id) => resolve(id)),
    }));
  return {
    id: doc._id.toHexString(),
    noteId: doc.noteId.toHexString(),
    author,
    text: doc.text,
    reactions,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toNotification(doc: NotificationDoc): Notification {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    message: doc.message,
    noteId: doc.noteId ? doc.noteId.toHexString() : null,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}
