"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  LIMITS,
  type NoteQuery,
  type NoteSort,
  type Tag,
  type UserPublic,
} from "@cinco-wiki/shared";
import { TagBadge } from "@/components/TagBadge";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/cn";

interface SearchFiltersProps {
  query: NoteQuery;
  onChange: (q: NoteQuery) => void;
  tags: Tag[];
  users: UserPublic[];
}

const SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: "recent", label: "Plus récentes" },
  { value: "oldest", label: "Plus anciennes" },
  { value: "top_rated", label: "Mieux notées" },
  { value: "most_commented", label: "Plus commentées" },
];

const fieldClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function SearchFilters({ query, onChange, tags, users }: SearchFiltersProps) {
  const [searchText, setSearchText] = useState(query.q ?? "");
  const [showFilters, setShowFilters] = useState(false);

  // Réfs « fraîches » pour ne pas figer la closure du debounce.
  const queryRef = useRef(query);
  const onChangeRef = useRef(onChange);
  queryRef.current = query;
  onChangeRef.current = onChange;

  // Émet une nouvelle requête (réinitialise toujours la pagination).
  const emit = useCallback(
    (patch: Partial<NoteQuery>) => {
      const next: NoteQuery = { ...queryRef.current, ...patch };
      delete next.cursor;
      onChangeRef.current(next);
    },
    [],
  );

  // Recherche full-text debouncée (LIMITS.searchDebounceMs = 300).
  useEffect(() => {
    if (searchText === (queryRef.current.q ?? "")) return;
    const t = setTimeout(() => emit({ q: searchText || undefined }), LIMITS.searchDebounceMs);
    return () => clearTimeout(t);
  }, [searchText, emit]);

  // Synchronise le champ si la requête change depuis l'extérieur.
  useEffect(() => {
    setSearchText(query.q ?? "");
  }, [query.q]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      emit({ q: searchText || undefined });
    } else if (e.key === "Escape" && searchText) {
      e.preventDefault();
      setSearchText("");
    }
  }

  function toggleTag(name: string) {
    const current = query.tags ?? [];
    const next = current.includes(name)
      ? current.filter((t) => t !== name)
      : [...current, name];
    emit({ tags: next.length ? next : undefined });
  }

  function reset() {
    setSearchText("");
    onChange({ sort: query.sort });
  }

  const selectedTags = query.tags ?? [];
  const activeCount =
    (query.q ? 1 : 0) +
    selectedTags.length +
    (query.authorId ? 1 : 0) +
    (query.dateFrom ? 1 : 0) +
    (query.dateTo ? 1 : 0) +
    (query.mine ? 1 : 0);

  return (
    <section
      aria-label="Recherche et filtres"
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
    >
      {/* Ligne 1 : recherche + tri */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div role="search" className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Rechercher une note…"
            aria-label="Rechercher une note"
            className={cn(fieldClass, "pl-9", searchText ? "pr-9" : "pr-3")}
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText("")}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative sm:w-52">
          <label htmlFor="filter-sort" className="sr-only">
            Trier les notes
          </label>
          <select
            id="filter-sort"
            value={query.sort ?? "recent"}
            onChange={(e) => emit({ sort: e.target.value as NoteSort })}
            className={cn(fieldClass, "cursor-pointer appearance-none pr-9")}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
        </div>
      </div>

      {/* Ligne 2 : bascules */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => emit({ mine: query.mine ? undefined : true })}
          aria-pressed={Boolean(query.mine)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-200",
            query.mine
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          <UserIcon aria-hidden="true" className="h-4 w-4" />
          Mes notes
        </button>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-controls="search-advanced-filters"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-200",
            showFilters || activeCount > 0
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Filtres
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition", showFilters && "rotate-180")}
          />
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Panneau avancé : tags, auteur, dates */}
      {showFilters && (
        <div
          id="search-advanced-filters"
          role="region"
          aria-label="Filtres avancés"
          className="animate-fade-in space-y-4 border-t border-gray-100 pt-4"
        >
          {tags.length > 0 && (
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
              </span>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                {tags.map((t) => (
                  <TagBadge
                    key={t.name}
                    tag={t.name}
                    active={selectedTags.includes(t.name)}
                    onClick={toggleTag}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="filter-author"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Auteur
              </label>
              <div className="relative">
                <select
                  id="filter-author"
                  value={query.authorId ?? ""}
                  onChange={(e) => emit({ authorId: e.target.value || undefined })}
                  className={cn(fieldClass, "cursor-pointer appearance-none pr-9")}
                >
                  <option value="">Tous les auteurs</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {fullName(u)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="filter-date-from"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Du
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={query.dateFrom ?? ""}
                max={query.dateTo || undefined}
                onChange={(e) => emit({ dateFrom: e.target.value || undefined })}
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="filter-date-to"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Au
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={query.dateTo ?? ""}
                min={query.dateFrom || undefined}
                onChange={(e) => emit({ dateTo: e.target.value || undefined })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
