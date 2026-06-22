"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import type { Tag } from "@cinco-wiki/shared";
import { LIMITS, normalizeTag } from "@cinco-wiki/shared";
import { api, ApiClientError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";

const PAGE_SIZE = 12;

type ModalState =
  | { type: "rename"; tag: Tag }
  | { type: "merge"; tag: Tag }
  | { type: "delete"; tag: Tag }
  | null;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

/** Gestion des tags (admin) : table paginée + renommer / fusionner / supprimer. */
export function TagManagementTable() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), LIMITS.searchDebounceMs);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced]);

  const { data, error, isLoading, mutate } = useSWR(["tags"], () => api.listTags());

  const filtered = useMemo(() => {
    const all = data ?? [];
    return debounced ? all.filter((t) => t.name.includes(debounced)) : all;
  }, [data, debounced]);

  const total = data?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Tous les noms existants — sert à l'autocomplétion / validation de fusion.
  const allNames = useMemo(() => (data ?? []).map((t) => t.name), [data]);

  function closeAndRefresh() {
    void mutate();
    setModal(null);
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {total} tag{total > 1 ? "s" : ""} au total.
        </p>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un tag…"
          aria-label="Rechercher un tag"
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des tags…" />
        </div>
      ) : error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
          Impossible de charger la liste des tags.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={debounced ? "Aucun résultat" : "Aucun tag"}
          description={
            debounced
              ? "Aucun tag ne correspond à votre recherche."
              : "Les tags apparaîtront ici dès que des notes en seront pourvues."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Tag</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Notes</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map((tag) => (
                  <tr key={tag.name} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">
                        #{tag.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{tag.count}</td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        tag={tag}
                        onRename={() => setModal({ type: "rename", tag })}
                        onMerge={() => setModal({ type: "merge", tag })}
                        onDelete={() => setModal({ type: "delete", tag })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <span aria-live="polite">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Page précédente"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Précédent
                </button>
                <span className="px-2 tabular-nums text-gray-500">
                  {page} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  aria-label="Page suivante"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal?.type === "rename" && (
        <RenameTagModal tag={modal.tag} onClose={() => setModal(null)} onDone={closeAndRefresh} />
      )}
      {modal?.type === "merge" && (
        <MergeTagModal
          tag={modal.tag}
          allNames={allNames}
          onClose={() => setModal(null)}
          onDone={closeAndRefresh}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteTagModal tag={modal.tag} onClose={() => setModal(null)} onDone={closeAndRefresh} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Menu d'actions par ligne
// ---------------------------------------------------------------------------

function RowActions({
  tag,
  onRename,
  onMerge,
  onDelete,
}: {
  tag: Tag;
  onRename: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions pour #${tag.name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions pour #${tag.name}`}
          className="absolute right-0 z-20 mt-1 w-48 origin-top-right overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg animate-scale-in focus:outline-none"
        >
          <MenuItem icon={Pencil} onClick={() => run(onRename)}>
            Renommer
          </MenuItem>
          <MenuItem icon={GitMerge} onClick={() => run(onMerge)}>
            Fusionner dans…
          </MenuItem>
          <div className="my-1 border-t border-gray-100" />
          <MenuItem icon={Trash2} tone="danger" onClick={() => run(onDelete)}>
            Supprimer
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  tone = "default",
}: {
  icon: typeof Pencil;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:bg-gray-50",
        tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Primitives de formulaire partagées
// ---------------------------------------------------------------------------

const FIELD_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

function ModalActions({
  busy,
  submitLabel,
  onCancel,
  tone = "brand",
  disabled = false,
}: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
  tone?: "brand" | "danger";
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg px-4 py-2 font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-60"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={busy || disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-60",
          tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700",
        )}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submitLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modale : renommer
// ---------------------------------------------------------------------------

function RenameTagModal({
  tag,
  onClose,
  onDone,
}: {
  tag: Tag;
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(tag.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTag(value);
  const unchanged = normalized === tag.name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) {
      setError("Le nom du tag ne peut pas être vide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.renameTag(tag.name, normalized);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Le renommage a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Renommer #${tag.name}`} size="sm" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="rename-tag" className="mb-1 block text-sm font-medium text-gray-700">
            Nouveau nom
          </label>
          <input
            id="rename-tag"
            required
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={FIELD_CLASS}
          />
          {normalized && normalized !== value.trim().toLowerCase() && (
            <p className="mt-1 text-xs text-gray-500">
              Enregistré comme <code className="font-mono">#{normalized}</code>.
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Le tag sera renommé sur les {tag.count} note{tag.count > 1 ? "s" : ""} concernée
            {tag.count > 1 ? "s" : ""}. Si le nouveau nom existe déjà, les tags fusionnent.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions
          busy={busy}
          disabled={unchanged}
          submitLabel="Renommer"
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale : fusionner
// ---------------------------------------------------------------------------

function MergeTagModal({
  tag,
  allNames,
  onClose,
  onDone,
}: {
  tag: Tag;
  allNames: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const into = normalizeTag(value);
  const sameAsSource = into === tag.name;
  const targets = allNames.filter((n) => n !== tag.name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!into) {
      setError("Choisissez un tag cible.");
      return;
    }
    if (sameAsSource) {
      setError("Le tag cible doit être différent du tag source.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.mergeTags(tag.name, into);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "La fusion a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Fusionner #${tag.name}`} size="sm" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Toutes les notes taguées <strong className="text-gray-900">#{tag.name}</strong> recevront
          le tag cible, puis <strong className="text-gray-900">#{tag.name}</strong> sera supprimé.
        </p>
        <div>
          <label htmlFor="merge-tag" className="mb-1 block text-sm font-medium text-gray-700">
            Fusionner dans
          </label>
          <input
            id="merge-tag"
            required
            autoFocus
            list="merge-tag-options"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nom du tag cible"
            className={FIELD_CLASS}
          />
          <datalist id="merge-tag-options">
            {targets.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {into && !sameAsSource && !allNames.includes(into) && (
            <p className="mt-1 text-xs text-gray-500">
              <code className="font-mono">#{into}</code> sera créé.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions busy={busy} submitLabel="Fusionner" onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale : supprimer
// ---------------------------------------------------------------------------

function DeleteTagModal({
  tag,
  onClose,
  onDone,
}: {
  tag: Tag;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteTag(tag.name);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "La suppression a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title="Supprimer le tag" size="sm" onClose={onClose}>
      <form onSubmit={confirm} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer le tag{" "}
            <strong className="font-semibold text-gray-900">#{tag.name}</strong> ? Il sera retiré
            des {tag.count} note{tag.count > 1 ? "s" : ""} concernée{tag.count > 1 ? "s" : ""}. Les
            notes elles-mêmes sont conservées.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions busy={busy} submitLabel="Supprimer" tone="danger" onCancel={onClose} />
      </form>
    </Modal>
  );
}
