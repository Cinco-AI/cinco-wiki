"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Pencil, Share2, X } from "lucide-react";
import type { Note } from "@cinco-wiki/shared";
import { Avatar } from "@/components/Avatar";
import { TagBadge } from "@/components/TagBadge";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { VoteSection } from "@/components/VoteSection";
import { Lightbox } from "@/components/Lightbox";
import { CommentsSection } from "@/components/CommentsSection";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fullName, relativeDate } from "@/lib/format";

interface NoteModalProps {
  noteId: string;
  onClose: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Détail d'une note en modale large/plein écran, partageable par URL (§5.2, §8). */
export function NoteModal({ noteId, onClose }: NoteModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: note, error, isLoading, mutate } = useSWR<Note>(
    noteId ? `note/${noteId}` : null,
    () => api.getNote(noteId),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Synchronise l'URL au montage pour permettre le partage / l'accès direct.
  useEffect(() => {
    const want = `/${noteId}`;
    if (typeof window !== "undefined" && window.location.pathname !== want) {
      window.history.replaceState(null, "", want);
    }
  }, [noteId]);

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${noteId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const images = note ? [...note.images].sort((a, b) => a.order - b.order) : [];
  const isAuthor = Boolean(user && note && user.id === note.author.id);

  return (
    <Modal onClose={onClose} size="full">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="scrollbar-thin overflow-y-auto px-6 py-6 sm:px-8">
          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Spinner />
            </div>
          )}

          {error && !isLoading && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
              <p className="text-gray-600">Impossible de charger cette note.</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                Fermer
              </button>
            </div>
          )}

          {note && (
            <article className="space-y-6">
              <header className="space-y-4 pr-10">
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">{note.title}</h2>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={note.author} size="md" />
                    <div>
                      <p className="font-medium text-gray-900">{fullName(note.author)}</p>
                      <p className="text-xs text-gray-500">{relativeDate(note.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAuthor && (
                      <button
                        type="button"
                        onClick={() => router.push(`/notes/${note.id}/edit`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={share}
                      aria-live="polite"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      {copied ? "Lien copié" : "Partager"}
                    </button>
                  </div>
                </div>

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <TagBadge
                        key={tag}
                        tag={tag}
                        onClick={(t) => router.push(`/tags/${encodeURIComponent(t)}`)}
                      />
                    ))}
                  </div>
                )}
              </header>

              <div
                className="prose-note max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: note.contentHtml }}
              />

              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((img, i) => (
                    <button
                      key={`${img.url}-${i}`}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      aria-label={`Agrandir l'image ${i + 1}`}
                      className="group overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Image ${i + 1}`}
                        loading="lazy"
                        className="h-32 w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}

              {note.links.length > 0 && (
                <div className="space-y-2">
                  {note.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 overflow-hidden rounded-xl border border-gray-200 transition hover:border-brand-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {link.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.image}
                          alt=""
                          loading="lazy"
                          className="h-24 w-32 shrink-0 object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1 py-2 pr-3">
                        <p className="truncate font-medium text-gray-900">
                          {link.title ?? link.url}
                        </p>
                        {link.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                            {link.description}
                          </p>
                        )}
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700">
                          <ExternalLink className="h-3 w-3" />
                          {link.domain ?? hostOf(link.url)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              <VoteSection
                note={note}
                onChange={(updated) => mutate(updated, { revalidate: false })}
              />

              <CommentsSection noteId={noteId} />
            </article>
          )}
        </div>
      </div>

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </Modal>
  );
}
