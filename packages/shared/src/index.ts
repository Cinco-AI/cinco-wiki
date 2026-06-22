/**
 * @cinco-wiki/shared — contrat d'API partagé entre le backend (Lambda) et le
 * frontend (Next.js). Source de vérité unique pour les DTO et les règles.
 */

// ---------------------------------------------------------------------------
// Constantes de règles métier (cf. §12 de la spec)
// ---------------------------------------------------------------------------

export const LIMITS = {
  noteTitleMax: 200,
  commentMax: 1000,
  tagsPerNote: 10,
  imagesPerNote: 10,
  imageMaxBytes: 5 * 1024 * 1024,
  linksPerNote: 5,
  cardExcerptChars: 150,
  voteMin: 1,
  voteMax: 5,
  searchDebounceMs: 300,
  autosaveMs: 60_000,
  rememberMeDays: 30,
} as const;

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "disabled";
export type NoteStatus = "published" | "draft";
export type NoteSort = "recent" | "oldest" | "top_rated" | "most_commented";

export type NotificationType =
  | "comment_on_note"
  | "vote_on_note"
  | "account_created"
  | "account_updated";

// ---------------------------------------------------------------------------
// DTO publics (ce que l'API renvoie — jamais de passwordHash)
// ---------------------------------------------------------------------------

export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  /** Auteur supprimé => placeholder « Utilisateur supprimé ». */
  avatarUrl: string | null;
}

export interface UserAdmin extends UserPublic {
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserSelf extends UserAdmin {
  stats: {
    notesCount: number;
    commentsCount: number;
    votesCount: number;
  };
}

export interface NoteImage {
  url: string;
  /** Ordre d'affichage dans la galerie. */
  order: number;
  width?: number;
  height?: number;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string | null;
}

export interface Note {
  id: string;
  title: string;
  /** HTML rendu (rich text TipTap), assaini côté serveur. */
  contentHtml: string;
  /** Texte brut dérivé — sert à l'extrait et à la recherche. */
  contentText: string;
  author: UserPublic;
  tags: string[];
  images: NoteImage[];
  links: LinkPreview[];
  status: NoteStatus;
  avgRating: number;
  voteCount: number;
  commentCount: number;
  /** Vote de l'utilisateur courant sur cette note (null si aucun). */
  myVote: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Variante allégée pour la grille de cards (§4.2). */
export interface NoteCard {
  id: string;
  title: string;
  excerpt: string;
  author: UserPublic;
  tags: string[];
  firstImage: string | null;
  firstLink: LinkPreview | null;
  avgRating: number;
  voteCount: number;
  commentCount: number;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  noteId: string;
  author: UserPublic;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  name: string;
  count: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  noteId: string | null;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Payloads de requête
// ---------------------------------------------------------------------------

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSelf;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  /** Mot de passe initial défini par l'administrateur (8 caractères min). */
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

/** Réponse de réinit. mot de passe : le mot de passe temporaire est montré 1 fois. */
export interface UserWithTempPassword {
  user: UserAdmin;
  temporaryPassword: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface NoteInput {
  title: string;
  contentHtml: string;
  tags: string[];
  images: NoteImage[];
  /** URLs brutes — le backend résout les métadonnées Open Graph. */
  links: string[];
  status: NoteStatus;
}

export interface CommentInput {
  text: string;
}

export interface VoteInput {
  value: number; // 1..5
}

export interface NoteQuery {
  q?: string;
  tags?: string[];
  authorId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: NoteSort;
  mine?: boolean;
  cursor?: string;
  limit?: number;
}

export interface PresignUploadInput {
  filename: string;
  contentType: (typeof IMAGE_MIME)[number];
  size: number;
}

export interface PresignUploadResult {
  uploadUrl: string;
  publicUrl: string;
  fields?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Enveloppes de réponse
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers partagés
// ---------------------------------------------------------------------------

/** Normalisation d'un tag : minuscule, trim, espaces internes condensés. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Extrait texte brut -> aperçu de card (150 car. + ellipse). */
export function buildExcerpt(text: string, max = LIMITS.cardExcerptChars): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + "…";
}
