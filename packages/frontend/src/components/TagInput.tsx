"use client";

import { useId, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Hash, X } from "lucide-react";
import { LIMITS, normalizeTag, type Tag } from "@cinco-wiki/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** id appliqué au champ de saisie (pour `<label htmlFor>`). */
  id?: string;
}

const MAX = LIMITS.tagsPerNote;

type Option =
  | { kind: "tag"; name: string; count: number }
  | { kind: "create"; name: string };

/**
 * Sélecteur de tags : multi-sélection, création à la volée (Entrée / virgule),
 * autocomplétion (`api.listTags`) et navigation clavier (combobox accessible).
 */
export function TagInput({ value, onChange, id }: TagInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const { data: allTags } = useSWR<Tag[]>("tags", () => api.listTags(), {
    revalidateOnFocus: false,
  });

  const full = value.length >= MAX;
  const normalizedQuery = normalizeTag(query);

  const suggestions = useMemo(() => {
    const selected = new Set(value);
    return (allTags ?? [])
      .filter((t) => !selected.has(t.name))
      .filter((t) => (normalizedQuery ? t.name.includes(normalizedQuery) : true))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [allTags, normalizedQuery, value]);

  const canCreate =
    normalizedQuery.length > 0 &&
    !value.includes(normalizedQuery) &&
    !suggestions.some((t) => t.name === normalizedQuery);

  const options: Option[] = [
    ...suggestions.map((t): Option => ({ kind: "tag", name: t.name, count: t.count })),
    ...(canCreate ? [{ kind: "create", name: normalizedQuery } as Option] : []),
  ];

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    setQuery("");
    setHighlight(0);
    if (!tag || value.includes(tag) || value.length >= MAX) return;
    onChange([...value, tag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Enter":
      case ",": {
        e.preventDefault();
        const opt = options[highlight];
        if (open && opt) addTag(opt.name);
        else addTag(query);
        break;
      }
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => (options.length ? Math.min(h + 1, options.length - 1) : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Escape":
        setOpen(false);
        break;
      case "Backspace": {
        if (query === "" && value.length > 0) {
          const last = value[value.length - 1];
          if (last) removeTag(last);
        }
        break;
      }
    }
  }

  const showList = open && options.length > 0;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200",
          full && "bg-gray-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-0.5 pl-2 pr-1 text-sm font-medium text-brand-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Retirer le tag ${tag}`}
              className="rounded-full p-0.5 text-brand-600 transition hover:bg-brand-200 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && options[highlight] ? `${listId}-${highlight}` : undefined
          }
          value={query}
          disabled={full}
          placeholder={
            full
              ? `Maximum ${MAX} tags atteint`
              : value.length
                ? "Ajouter…"
                : "Ajouter des tags…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="scrollbar-thin absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg animate-fade-in"
        >
          {options.map((opt, i) => (
            <li
              key={opt.kind + ":" + opt.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(opt.name);
              }}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm",
                i === highlight ? "bg-brand-50 text-brand-800" : "text-gray-700",
              )}
            >
              {opt.kind === "create" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                  Créer «&nbsp;<strong className="font-semibold">{opt.name}</strong>&nbsp;»
                </span>
              ) : (
                <>
                  <span className="truncate">{opt.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{opt.count}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-gray-400">
        {value.length}/{MAX} tags · Entrée ou virgule pour ajouter
      </p>
    </div>
  );
}
