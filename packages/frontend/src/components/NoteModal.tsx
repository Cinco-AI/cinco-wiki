"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Loader2,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import type { Note } from "@cinco-wiki/shared";
import { Avatar } from "@/components/Avatar";
import { TagBadge } from "@/components/TagBadge";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { VoteSection } from "@/components/VoteSection";
import { Lightbox } from "@/components/Lightbox";
import { CommentsSection } from "@/components/CommentsSection";
import { api, ApiClientError } from "@/lib/api";
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} Ko`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} Mo`;
}

/** Icône en fonction du type MIME du document. */
function attachmentIcon(type: string) {
  if (type.includes("spreadsheet") || type === "application/vnd.ms-excel" || type === "text/csv")
    return FileSpreadsheet;
  if (type.includes("zip")) return FileArchive;
  if (type === "application/pdf" || type.startsWith("text/")) return FileText;
  return FileIcon;
}

/** Détail d'une note en modale large/plein écran, partageable par URL (§5.2, §8). */
export function NoteModal({ noteId, onClose }: NoteModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: note, error, isLoading, mutate } = useSWR<Note>(
    noteId ? `note/${noteId}` : null,
    () => api.getNote(noteId),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const canDelete = Boolean(note && (isAuthor || user?.role === "admin"));

  async function handleDelete() {
    if (!note) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteNote(note.id);
      // Rafraîchit la liste des notes et les compteurs de tags.
      await globalMutate(
        (key) => Array.isArray(key) && (key[0] === "notes" || key[0] === "tags"),
        undefined,
        { revalidate: true },
      );
      onClose();
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError ? err.message : "La suppression a échoué. Réessayez.",
      );
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="xl">
        <div className="px-6 py-6 sm:px-8">
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
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmingDelete(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
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

              {note.attachments?.length > 0 && (
                <div className="space-y-2">
                  {note.attachments.map((file, i) => {
                    const Icon = attachmentIcon(file.contentType);
                    return (
                      <a
                        key={`${file.url}-${i}`}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 transition hover:border-brand-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                        </div>
                        <Download
                          className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-brand-600"
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
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

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}

      {confirmingDelete && (
        <Modal
          title="Supprimer la note"
          size="sm"
          onClose={() => {
            if (!deleting) setConfirmingDelete(false);
          }}
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-sm text-gray-600">
                Voulez-vous vraiment supprimer cette note ? Les commentaires et votes
                associés seront aussi supprimés. Cette action est irréversible.
              </p>
            </div>

            {deleteError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
