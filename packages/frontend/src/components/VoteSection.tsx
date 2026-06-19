"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Note } from "@noteshare/shared";
import { Stars } from "@/components/Stars";
import { api, ApiClientError } from "@/lib/api";

interface VoteSectionProps {
  note: Note;
  onChange: (updated: Note) => void;
}

/** Notation interactive (1..5) : pose/retire le vote et affiche la moyenne (§8.3). */
export function VoteSection({ note, onChange }: VoteSectionProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRate(value: number) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // Cliquer à nouveau sur sa propre note la retire.
      const updated =
        value === note.myVote
          ? await api.removeVote(note.id)
          : await api.setVote(note.id, { value });
      onChange(updated);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Impossible d'enregistrer votre vote.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    if (pending || note.myVote == null) return;
    setPending(true);
    setError(null);
    try {
      onChange(await api.removeVote(note.id));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Impossible de retirer votre vote.",
      );
    } finally {
      setPending(false);
    }
  }

  const hasVotes = note.voteCount > 0;
  const average = note.avgRating.toFixed(1).replace(".", ",");

  return (
    <section
      aria-label="Notation"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Moyenne (lecture seule) */}
        <div className="flex items-center gap-3">
          <Stars value={note.avgRating} size="md" />
          <div>
            <p className="text-2xl font-bold leading-none text-gray-900">
              {hasVotes ? average : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {note.voteCount} vote{note.voteCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Vote de l'utilisateur courant (interactif) */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="text-sm font-medium text-gray-700">Votre note</span>
          <div className={pending ? "pointer-events-none opacity-60" : undefined}>
            <Stars
              value={note.myVote ?? 0}
              myVote={note.myVote}
              interactive
              size="lg"
              onRate={handleRate}
            />
          </div>
          {note.myVote != null && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-gray-500 transition hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Retirer mon vote
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
