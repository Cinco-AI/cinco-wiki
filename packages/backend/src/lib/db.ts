import { MongoClient, type Db, type Collection, type ObjectId } from "mongodb";
import type {
  LinkPreview,
  NoteAttachment,
  NoteImage,
  NoteStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from "@cinco-wiki/shared";
import { env } from "./env.js";

// ---------------------------------------------------------------------------
// Documents internes MongoDB (avec ObjectId). Jamais exposés tels quels :
// passer par les mappers de ../models avant de renvoyer au client.
// ---------------------------------------------------------------------------

export interface UserDoc {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string; // stocké en minuscule
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  /** Incrémenté à chaque reset/désactivation pour invalider les refresh tokens. */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteDoc {
  _id: ObjectId;
  title: string;
  contentHtml: string;
  contentText: string;
  authorId: ObjectId | null; // null => « Utilisateur supprimé »
  tags: string[];
  images: NoteImage[];
  attachments: NoteAttachment[];
  links: LinkPreview[];
  status: NoteStatus;
  // Compteurs dénormalisés (recalculés à chaque vote/commentaire).
  avgRating: number;
  voteCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoteDoc {
  _id: ObjectId;
  noteId: ObjectId;
  userId: ObjectId;
  value: number; // 1..5
  createdAt: Date;
  updatedAt: Date;
}

/** Réaction emoji + la liste des utilisateurs qui l'ont posée (dénormalisé). */
export interface CommentReactionDoc {
  emoji: string;
  userIds: ObjectId[];
}

export interface CommentDoc {
  _id: ObjectId;
  noteId: ObjectId;
  authorId: ObjectId | null;
  text: string;
  /** Optionnel : absent sur les commentaires créés avant la fonctionnalité. */
  reactions?: CommentReactionDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TagDoc {
  _id: ObjectId;
  name: string; // normalisé, unique
  count: number;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId; // destinataire
  type: NotificationType;
  message: string;
  noteId: ObjectId | null;
  read: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Connexion mise en cache entre invocations Lambda (réutilisation du socket).
// ---------------------------------------------------------------------------

let client: MongoClient | null = null;
let dbPromise: Promise<Db> | null = null;

async function connect(): Promise<Db> {
  client = new MongoClient(env.mongoUri, {
    maxPoolSize: 10,
    retryWrites: true,
  });
  await client.connect();
  const db = client.db(env.dbName);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = connect();
  return dbPromise;
}

export const collections = {
  users: (db: Db): Collection<UserDoc> => db.collection<UserDoc>("users"),
  notes: (db: Db): Collection<NoteDoc> => db.collection<NoteDoc>("notes"),
  votes: (db: Db): Collection<VoteDoc> => db.collection<VoteDoc>("votes"),
  comments: (db: Db): Collection<CommentDoc> => db.collection<CommentDoc>("comments"),
  tags: (db: Db): Collection<TagDoc> => db.collection<TagDoc>("tags"),
  notifications: (db: Db): Collection<NotificationDoc> =>
    db.collection<NotificationDoc>("notifications"),
};

let indexesReady = false;
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  indexesReady = true;
  await Promise.all([
    collections.users(db).createIndex({ email: 1 }, { unique: true }),
    collections.notes(db).createIndex({ status: 1, createdAt: -1 }),
    collections.notes(db).createIndex({ authorId: 1 }),
    collections.notes(db).createIndex({ tags: 1 }),
    // Index texte sur le titre uniquement (contentText non indexé).
    collections.notes(db).createIndex({ title: "text" }),
    collections.votes(db).createIndex({ noteId: 1, userId: 1 }, { unique: true }),
    collections.comments(db).createIndex({ noteId: 1, createdAt: 1 }),
    collections.tags(db).createIndex({ name: 1 }, { unique: true }),
    collections.notifications(db).createIndex({ userId: 1, createdAt: -1 }),
  ]);
}
