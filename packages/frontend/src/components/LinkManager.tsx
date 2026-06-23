"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  ImageOff,
  Link2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { LIMITS, type LinkPreview } from "@cinco-wiki/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface LinkManagerProps {
  links: string[];
  onChange: (urls: string[]) => void;
}

type PreviewState =
  | { status: "loading" }
  | { status: "loaded"; data: LinkPreview }
  | { status: "error" };

/** Normalise une URL saisie : ajoute `https://` si le schéma manque. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function LinkManager({ links, onChange }: LinkManagerProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const requested = useRef<Set<string>>(new Set());

  // Récupère l'aperçu Open Graph de chaque URL pas encore demandée.
  useEffect(() => {
    let active = true;
    for (const url of links) {
      if (requested.current.has(url)) continue;
      requested.current.add(url);
      setPreviews((p) => ({ ...p, [url]: { status: "loading" } }));
      api
        .fetchOg(url)
        .then((data) => {
          if (active) setPreviews((p) => ({ ...p, [url]: { status: "loaded", data } }));
        })
        .catch(() => {
          if (active) setPreviews((p) => ({ ...p, [url]: { status: "error" } }));
        });
    }
    return () => {
      active = false;
    };
  }, [links]);

  const atMax = links.length >= LIMITS.linksPerNote;

  function addUrl() {
    const url = normalizeUrl(input);
    if (!url) {
      setError("Saisissez une URL valide.");
      return;
    }
    if (links.includes(url)) {
      setError("Ce lien a déjà été ajouté.");
      return;
    }
    if (atMax) {
      setError(
        LIMITS.linksPerNote === 1
          ? "Un seul lien externe par note."
          : `Maximum ${LIMITS.linksPerNote} liens par note.`,
      );
      return;
    }
    setError(null);
    setInput("");
    onChange([...links, url]);
  }

  function removeUrl(url: string) {
    onChange(links.filter((l) => l !== url));
    if (error) setError(null);
  }

  function retry(url: string) {
    setPreviews((p) => ({ ...p, [url]: { status: "loading" } }));
    api
      .fetchOg(url)
      .then((data) => setPreviews((p) => ({ ...p, [url]: { status: "loaded", data } })))
      .catch(() => setPreviews((p) => ({ ...p, [url]: { status: "error" } })));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addUrl();
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="link-manager-title">
      <div className="flex items-center justify-between">
        <h3
          id="link-manager-title"
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Link2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
          {LIMITS.linksPerNote === 1 ? "Lien externe" : "Liens externes"}
        </h3>
        {LIMITS.linksPerNote > 1 && (
          <span className="text-xs text-gray-400" aria-live="polite">
            {links.length}/{LIMITS.linksPerNote}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={atMax}
          placeholder={
            atMax
              ? LIMITS.linksPerNote === 1
                ? "Un seul lien autorisé"
                : "Limite de liens atteinte"
              : "https://exemple.com/article"
          }
          aria-label="Ajouter une URL"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "link-manager-error" : undefined}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={atMax || !input.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Ajouter</span>
        </button>
      </div>

      {error && (
        <p
          id="link-manager-error"
          role="alert"
          className="flex items-center gap-1.5 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((url) => {
            const state = previews[url] ?? { status: "loading" };
            return (
              <li
                key={url}
                className="group flex items-stretch gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-brand-200"
              >
                <LinkThumb state={state} />

                <div className="min-w-0 flex-1 self-center">
                  {state.status === "loading" && (
                    <p className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Chargement de l'aperçu…
                    </p>
                  )}

                  {state.status === "error" && (
                    <div className="space-y-1">
                      <p className="truncate text-sm font-medium text-gray-700">{url}</p>
                      <button
                        type="button"
                        onClick={() => retry(url)}
                        className="text-xs font-medium text-brand-700 underline transition hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                      >
                        Aperçu indisponible — réessayer
                      </button>
                    </div>
                  )}

                  {state.status === "loaded" && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    >
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span className="truncate">{state.data.domain ?? new URL(url).hostname}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-sm font-semibold text-gray-900">
                        {state.data.title ?? url}
                      </span>
                      {state.data.description && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                          {state.data.description}
                        </span>
                      )}
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeUrl(url)}
                  aria-label={`Supprimer le lien ${url}`}
                  className="shrink-0 self-start rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LinkThumb({ state }: { state: PreviewState }) {
  const [broken, setBroken] = useState(false);
  const image = state.status === "loaded" ? state.data.image : null;

  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-28"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg sm:h-20 sm:w-28",
        "bg-brand-50 text-brand-300",
      )}
    >
      {state.status === "loading" ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : state.status === "error" ? (
        <ImageOff className="h-5 w-5" />
      ) : (
        <Link2 className="h-5 w-5" />
      )}
    </div>
  );
}
