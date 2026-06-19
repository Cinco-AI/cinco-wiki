"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import type { NoteCard as NoteCardDto, NoteQuery, UserPublic } from "@noteshare/shared";
import { api } from "@/lib/api";
import { NoteCard } from "@/components/NoteCard";
import { SearchFilters } from "@/components/SearchFilters";
import { NoteModal } from "@/components/NoteModal";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";

interface NotesDashboardProps {
  openNoteId?: string;
  initialTag?: string;
}

/**
 * Tableau de bord (§4) : grille de notes filtrable + pagination « Charger plus »,
 * et modale partageable montée lorsque `openNoteId` est défini (route /[id]).
 */
export function NotesDashboard({ openNoteId, initialTag }: NotesDashboardProps) {
  const router = useRouter();

  // Filtre courant. Par défaut « Mes notes » sur le tableau de bord nu
  // (ni tag ni note ouverte), sinon vue globale.
  const [query, setQuery] = useState<NoteQuery>(() => ({
    mine: !initialTag && !openNoteId,
    tags: initialTag ? [initialTag] : undefined,
    sort: "recent",
  }));

  // Items des pages déjà chargées (avant le curseur courant) : permet
  // d'accumuler les pages sans useSWRInfinite.
  const [prevPages, setPrevPages] = useState<NoteCardDto[]>([]);

  const { data, error, isLoading, isValidating } = useSWR(
    ["notes", query],
    () => api.listNotes(query),
    { keepPreviousData: true },
  );

  const { data: tags } = useSWR(["tags"], () => api.listTags());

  // Concatène pages précédentes + page courante, dédupliqué par id.
  const items = useMemo(() => {
    const map = new Map<string, NoteCardDto>();
    for (const n of prevPages) map.set(n.id, n);
    for (const n of data?.items ?? []) map.set(n.id, n);
    return [...map.values()];
  }, [prevPages, data]);

  // Auteurs dérivés (dédupliqués) pour le filtre auteur de SearchFilters.
  const users = useMemo<UserPublic[]>(() => {
    const map = new Map<string, UserPublic>();
    for (const n of items) map.set(n.author.id, n.author);
    return [...map.values()];
  }, [items]);

  // Resynchronise le filtre quand le tag de la route (/tags/[tag]) change.
  const lastTag = useRef(initialTag);
  useEffect(() => {
    if (initialTag !== lastTag.current) {
      lastTag.current = initialTag;
      setPrevPages([]);
      setQuery((q) => ({ ...q, tags: initialTag ? [initialTag] : undefined, cursor: undefined }));
    }
  }, [initialTag]);

  function applyQuery(next: NoteQuery) {
    setPrevPages([]);
    setQuery({ ...next, cursor: undefined });
  }

  function loadMore() {
    if (!data?.nextCursor) return;
    setPrevPages(items); // fige la liste affichée avant de charger la suite
    setQuery((q) => ({ ...q, cursor: data.nextCursor! }));
  }

  const loadingMore = isValidating && Boolean(query.cursor);
  const firstLoading = isLoading && items.length === 0;

  return (
    <section aria-label="Tableau de bord des notes" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <SearchFilters query={query} onChange={applyQuery} tags={tags ?? []} users={users} />

      {firstLoading ? (
        <div className="flex justify-center py-20" aria-live="polite">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          title="Impossible de charger les notes"
          description="Une erreur est survenue. Réessayez dans un instant."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Aucune note"
          description={
            query.mine
              ? "Vous n'avez pas encore créé de note."
              : "Aucune note ne correspond à votre recherche."
          }
        />
      ) : (
        <>
          <div
            aria-busy={isValidating}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {items.map((note) => (
              <NoteCard key={note.id} note={note} onOpen={(id) => router.push(`/${id}`)} />
            ))}
          </div>

          {data?.nextCursor && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {loadingMore ? "Chargement…" : "Charger plus"}
              </button>
            </div>
          )}
        </>
      )}

      {openNoteId && <NoteModal noteId={openNoteId} onClose={() => router.push("/")} />}
    </section>
  );
}
