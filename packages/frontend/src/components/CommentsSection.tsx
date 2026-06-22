"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import type { Comment } from "@cinco-wiki/shared";
import { LIMITS } from "@cinco-wiki/shared";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relativeDate, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmojiPicker } from "@/components/EmojiPicker";

/** Insère `emoji` à la position du curseur dans un textarea contrôlé. */
function insertEmojiAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  emoji: string,
  setValue: (next: string) => void,
) {
  const start = textarea?.selectionStart ?? current.length;
  const end = textarea?.selectionEnd ?? current.length;
  const next = current.slice(0, start) + emoji + current.slice(end);
  if (next.length > LIMITS.commentMax) return;
  setValue(next);
  // Restaure le focus + le curseur après le rendu React.
  requestAnimationFrame(() => {
    if (!textarea) return;
    const pos = start + emoji.length;
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
  });
}

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
        <ul className="space-y-4">
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
  const [confirming, setConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    setBusy(true);
    setError(null);
    try {
      await api.deleteComment(comment.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setConfirming(false);
      setError(
        err instanceof ApiClientError ? err.message : "La suppression a échoué. Réessayez.",
      );
      setBusy(false);
    }
  }

  return (
    <li className="relative flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow">
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
              ref={textareaRef}
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
              <EmojiPicker
                onSelect={(emoji) =>
                  insertEmojiAtCursor(textareaRef.current, draft, emoji, setDraft)
                }
              />
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
                onClick={() => setConfirming(true)}
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

      {!editing && <ReactionBar comment={comment} onChanged={onChanged} />}

      <ConfirmDialog
        open={confirming}
        title="Supprimer le commentaire"
        message="Supprimer ce commentaire ? Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}

/** Pastilles de réactions + ajout d'emoji, façon Slack (toggle par lecteur). */
function ReactionBar({
  comment,
  onChanged,
}: {
  comment: Comment;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.toggleReaction(comment.id, emoji);
      onChanged();
    } catch {
      // Échec silencieux : l'état se resynchronise au prochain chargement.
    } finally {
      setBusy(false);
    }
  }

  if (comment.reactions?.length === 0 && !user) return null;

  return (
    <div className="absolute bottom-0 right-3 z-10 flex -translate-y-1/2 flex-wrap items-center justify-end gap-1.5 drop-shadow-sm">
      {comment.reactions?.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => void toggle(r.emoji)}
          disabled={busy || !user}
          aria-pressed={r.reacted}
          title={r.reacted ? "Retirer votre réaction" : "Réagir"}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-60",
            r.reacted
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          )}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="font-medium tabular-nums">{r.count}</span>
        </button>
      ))}
      {user && (
        <EmojiPicker
          onSelect={(emoji) => void toggle(emoji)}
          className="[&>button]:h-7 [&>button]:w-7"
        />
      )}
    </div>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          ref={textareaRef}
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
          <div className="flex items-center gap-2">
            <EmojiPicker
              onSelect={(emoji) =>
                insertEmojiAtCursor(textareaRef.current, text, emoji, setText)
              }
            />
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
          </div>
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
