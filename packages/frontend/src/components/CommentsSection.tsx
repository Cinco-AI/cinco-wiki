"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import type { Comment } from "@noteshare/shared";
import { LIMITS } from "@noteshare/shared";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relativeDate, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";

export function CommentsSection({ noteId }: { noteId: string }) {
  const { user, isAdmin } = useAuth();
  const swrKey = ["comments", noteId] as const;
  const {
    data: comments,
    error,
    isLoading,
    mutate,
  } = useSWR(swrKey, () => api.listComments(noteId));

  // Tri à plat : du plus ancien au plus récent (§9).
  const sorted = comments
    ? [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h3
        id="comments-heading"
        className="flex items-center gap-2 text-lg font-semibold text-gray-900"
      >
        <MessageSquare className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Commentaires
        {comments && (
          <span className="text-sm font-normal text-gray-400">({comments.length})</span>
        )}
      </h3>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement des commentaires…
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Impossible de charger les commentaires.
        </p>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
          Aucun commentaire pour le moment. Soyez le premier à réagir.
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-3">
          {sorted.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canEdit={user?.id === comment.author.id}
              canDelete={user?.id === comment.author.id || isAdmin}
              onChanged={() => mutate()}
            />
          ))}
        </ul>
      )}

      <CommentForm noteId={noteId} onAdded={() => mutate()} />
    </section>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  onChanged,
}: {
  comment: Comment;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = comment.updatedAt !== comment.createdAt;

  async function save() {
    const text = draft.trim();
    if (!text || text === comment.text) {
      setEditing(false);
      setDraft(comment.text);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateComment(comment.id, { text });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "La modification a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteComment(comment.id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "La suppression a échoué. Réessayez.",
      );
      setBusy(false);
    }
  }

  return (
    <li className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow">
      <Avatar user={comment.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-gray-900">
            {fullName(comment.author)}
          </span>
          <time
            dateTime={comment.createdAt}
            className="text-xs text-gray-400"
            title={new Date(comment.createdAt).toLocaleString("fr-FR")}
          >
            {relativeDate(comment.createdAt)}
            {edited && " · modifié"}
          </time>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={draft}
              autoFocus
              maxLength={LIMITS.commentMax}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(comment.text);
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                }
              }}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              aria-label="Modifier le commentaire"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.text);
                  setError(null);
                }}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
            {comment.text}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        )}

        {!editing && (canEdit || canDelete) && (
          <div className="mt-1.5 flex items-center gap-3">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-gray-500 transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Modifier
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-gray-500 transition hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function CommentForm({
  noteId,
  onAdded,
}: {
  noteId: string;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment(noteId, { text: value });
      setText("");
      onAdded();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "L'envoi du commentaire a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  const remaining = LIMITS.commentMax - text.length;

  return (
    <form onSubmit={submit} className="flex gap-3 pt-1">
      {user && <Avatar user={user} size="sm" />}
      <div className="min-w-0 flex-1">
        <label htmlFor="new-comment" className="sr-only">
          Ajouter un commentaire
        </label>
        <textarea
          id="new-comment"
          value={text}
          rows={3}
          maxLength={LIMITS.commentMax}
          placeholder="Ajouter un commentaire…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit(e as unknown as React.FormEvent);
            }
          }}
          className="w-full resize-y rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-xs",
              remaining <= 50 ? "text-red-500" : "text-gray-400",
            )}
            aria-live="polite"
          >
            {remaining} caractère{remaining > 1 ? "s" : ""} restant
            {remaining > 1 ? "s" : ""}
          </span>
          <button
            type="submit"
            disabled={busy || text.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Publier
          </button>
        </div>
      </div>
    </form>
  );
}
