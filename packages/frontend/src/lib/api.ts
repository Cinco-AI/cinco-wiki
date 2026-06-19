/**
 * Client API typé pour le backend (API Gateway + Lambda).
 * - access token gardé en mémoire, refresh token persistant (localStorage).
 * - rafraîchissement transparent sur 401, avec déduplication des refresh.
 */
import type {
  ApiError,
  AuthTokens,
  Comment,
  CommentInput,
  CreateUserInput,
  LoginInput,
  Note,
  NoteCard,
  NoteInput,
  NoteQuery,
  Notification,
  Paginated,
  PresignUploadInput,
  PresignUploadResult,
  Tag,
  UpdateProfileInput,
  UpdateUserInput,
  UserAdmin,
  UserSelf,
  UserWithTempPassword,
  VoteInput,
} from "@cinco-wiki/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const REFRESH_KEY = "cinco-wiki.refresh";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const tokenStore = {
  setSession(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
  },
  clear() {
    accessToken = null;
    if (typeof window !== "undefined") localStorage.removeItem(REFRESH_KEY);
  },
  getRefresh(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
  },
  hasSession(): boolean {
    return Boolean(this.getRefresh());
  },
};

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    tokenStore.setSession((await res.json()) as AuthTokens);
    return true;
  } catch {
    return false;
  }
}

/** Déduplique les refresh concurrents. */
function refresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  retry?: boolean;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
      else url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && opts.retry !== false) {
    const ok = await refresh();
    if (ok) return request<T>(path, { ...opts, retry: false });
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      res.status,
      err?.code ?? "ERROR",
      err?.error ?? res.statusText,
      err?.details,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** API typée — surface complète consommée par le frontend. */
export const api = {
  raw: request,
  refresh,

  // --- Auth ---
  login: (input: LoginInput) =>
    request<AuthTokens>("/auth/login", { method: "POST", body: input }),
  me: () => request<UserSelf>("/auth/me"),
  bootstrap: async (): Promise<UserSelf | null> => {
    if (!tokenStore.hasSession()) return null;
    if (!(await refresh())) return null;
    return request<UserSelf>("/auth/me");
  },

  // --- Notes ---
  listNotes: (query: NoteQuery = {}) =>
    request<Paginated<NoteCard>>("/notes", { query: query as Record<string, unknown> }),
  getNote: (id: string) => request<Note>(`/notes/${id}`),
  createNote: (input: NoteInput) => request<Note>("/notes", { method: "POST", body: input }),
  updateNote: (id: string, input: NoteInput) =>
    request<Note>(`/notes/${id}`, { method: "PUT", body: input }),
  deleteNote: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),

  // --- Votes ---
  setVote: (noteId: string, input: VoteInput) =>
    request<Note>(`/votes/${noteId}`, { method: "PUT", body: input }),
  removeVote: (noteId: string) => request<Note>(`/votes/${noteId}`, { method: "DELETE" }),

  // --- Comments ---
  listComments: (noteId: string) => request<Comment[]>(`/comments/${noteId}`),
  addComment: (noteId: string, input: CommentInput) =>
    request<Comment>(`/comments/${noteId}`, { method: "POST", body: input }),
  updateComment: (id: string, input: CommentInput) =>
    request<Comment>(`/comments/item/${id}`, { method: "PUT", body: input }),
  deleteComment: (id: string) => request<void>(`/comments/item/${id}`, { method: "DELETE" }),

  // --- Tags ---
  listTags: () => request<Tag[]>("/tags"),
  mergeTags: (from: string, into: string) =>
    request<void>("/tags/merge", { method: "POST", body: { from, into } }),
  renameTag: (name: string, to: string) =>
    request<void>(`/tags/${encodeURIComponent(name)}`, { method: "PUT", body: { to } }),
  deleteTag: (name: string) =>
    request<void>(`/tags/${encodeURIComponent(name)}`, { method: "DELETE" }),

  // --- Notifications ---
  listNotifications: () => request<Notification[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<void>("/notifications/read-all", { method: "POST" }),

  // --- Uploads ---
  presignUpload: (input: PresignUploadInput) =>
    request<PresignUploadResult>("/uploads/presign", { method: "POST", body: input }),
  fetchOg: (url: string) =>
    request<import("@cinco-wiki/shared").LinkPreview>("/og", { query: { url } }),

  // --- Users (admin) ---
  listUsers: (q?: string) =>
    request<Paginated<UserAdmin>>("/users", { query: { q } }),
  createUser: (input: CreateUserInput) =>
    request<UserWithTempPassword>("/users", { method: "POST", body: input }),
  updateUser: (id: string, input: UpdateUserInput) =>
    request<UserAdmin>(`/users/${id}`, { method: "PUT", body: input }),
  resetUserPassword: (id: string) =>
    request<UserWithTempPassword>(`/users/${id}/reset-password`, { method: "POST" }),
  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),

  // --- Profil ---
  updateProfile: (input: UpdateProfileInput) =>
    request<UserSelf>("/users/me/profile", { method: "PUT", body: input }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/users/me/password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),
};
