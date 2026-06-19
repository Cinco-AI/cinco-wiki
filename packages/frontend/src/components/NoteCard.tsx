"use client";

import { useRouter } from "next/navigation";
import { Link2, MessageCircle, Pencil } from "lucide-react";
import type { NoteCard as NoteCardModel } from "@cinco-wiki/shared";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { TagBadge } from "@/components/TagBadge";
import { fullName, relativeDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

interface NoteCardProps {
  note: NoteCardModel;
  onOpen: (id: string) => void;
}

/** Carte de note pour la grille du tableau de bord (§4.2). */
export function NoteCard({ note, onOpen }: NoteCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.id === note.author.id;

  const visibleTags = note.tags.slice(0, 3);
  const extraTags = note.tags.length - visibleTags.length;
  const authorName = fullName(note.author);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-gray-200",
        "bg-white shadow-sm transition hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-brand-200",
      )}
    >
      {note.firstImage && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={note.firstImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* En-tête : tags + crayon (édition si propriétaire) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {extraTags > 0 && (
              <span
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                aria-label={`${extraTags} tag${extraTags > 1 ? "s" : ""} supplémentaire${extraTags > 1 ? "s" : ""}`}
              >
                +{extraTags}
              </span>
            )}
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/notes/${note.id}/edit`);
              }}
              aria-label={`Modifier la note « ${note.title} »`}
              title="Modifier"
              className={cn(
                "relative z-10 shrink-0 rounded-lg p-1.5 text-gray-400 transition",
                "hover:bg-brand-50 hover:text-brand-600",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
              )}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Titre — déclencheur d'ouverture, étiré sur toute la carte */}
        <h3 className="text-base font-semibold leading-snug text-gray-900">
          <button
            type="button"
            onClick={() => onOpen(note.id)}
            className={cn(
              "line-clamp-2 text-left transition group-hover:text-brand-700",
              "before:absolute before:inset-0 before:content-['']",
              "focus:outline-none",
            )}
          >
            {note.title}
          </button>
        </h3>

        {/* Extrait */}
        {note.excerpt && (
          <p className="line-clamp-3 text-sm text-gray-500">{note.excerpt}</p>
        )}

        {/* Aperçu du premier lien */}
        {note.firstLink && (
          <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 p-2">
            {note.firstLink.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={note.firstLink.image}
                alt=""
                loading="lazy"
                className="h-9 w-9 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-200 text-gray-500">
                <Link2 className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-gray-700">
                {note.firstLink.title ?? note.firstLink.domain ?? note.firstLink.url}
              </span>
              {note.firstLink.domain && (
                <span className="block truncate text-[11px] text-gray-400">
                  {note.firstLink.domain}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Pied : auteur + métriques */}
        <div className="mt-auto flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Avatar user={note.author} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-700">{authorName}</p>
              <time
                dateTime={note.createdAt}
                className="text-xs text-gray-400"
              >
                {relativeDate(note.createdAt)}
              </time>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Stars value={note.avgRating} size="sm" />
              <span
                className="text-xs text-gray-400"
                aria-label={`${note.voteCount} vote${note.voteCount > 1 ? "s" : ""}`}
              >
                ({note.voteCount})
              </span>
            </div>

            <span
              className="relative z-10 flex items-center gap-1 text-gray-400"
              aria-label={`${note.commentCount} commentaire${note.commentCount > 1 ? "s" : ""}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">{note.commentCount}</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
