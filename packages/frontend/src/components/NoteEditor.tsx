"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { AlertCircle, Check, Loader2, Save, Send } from "lucide-react";
import {
  LIMITS,
  type Note,
  type NoteAttachment,
  type NoteImage,
  type NoteInput,
  type NoteStatus,
} from "@cinco-wiki/shared";
import { api, ApiClientError } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";
import { LinkManager } from "@/components/LinkManager";
import { ImageUploader } from "@/components/ImageUploader";
import { DocumentUploader } from "@/components/DocumentUploader";
import { TagInput } from "@/components/TagInput";
import { Spinner } from "@/components/Spinner";

interface NoteEditorProps {
  mode: "create" | "edit";
  noteId?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Empreinte des champs persistés — sert au suivi des modifications (dirty). */
function serialize(
  title: string,
  html: string,
  tags: string[],
  images: NoteImage[],
  attachments: NoteAttachment[],
  links: string[],
): string {
  return JSON.stringify({ title: title.trim(), html, tags, images, attachments, links });
}

/**
 * Éditeur de note (§6) : titre, contenu riche, images, liens, tags.
 * Publier / Enregistrer en brouillon / Annuler + autosave périodique.
 */
export function NoteEditor({ mode, noteId }: NoteEditorProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const {
    data: loaded,
    error: loadError,
    isLoading,
  } = useSWR<Note>(
    isEdit && noteId ? ["note", noteId] : null,
    () => api.getNote(noteId as string),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(
    mode === "create" ? serialize("", "", [], [], [], []) : null,
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);

  const idRef = useRef<string | null>(isEdit ? (noteId ?? null) : null);
  const statusRef = useRef<NoteStatus>("draft");
  const savedRef = useRef<string | null>(savedSnapshot);

  // Pré-remplissage en mode édition (une fois la note chargée).
  useEffect(() => {
    if (!loaded) return;
    setTitle(loaded.title);
    setContentHtml(loaded.contentHtml);
    setTags(loaded.tags);
    setImages(loaded.images);
    setAttachments(loaded.attachments ?? []);
    setLinks(loaded.links.map((l) => l.url));
    statusRef.current = loaded.status;
    idRef.current = loaded.id;
    const snap = serialize(
      loaded.title,
      loaded.contentHtml,
      loaded.tags,
      loaded.images,
      loaded.attachments ?? [],
      loaded.links.map((l) => l.url),
    );
    setSavedSnapshot(snap);
    savedRef.current = snap;
  }, [loaded]);

  const currentSnapshot = serialize(title, contentHtml, tags, images, attachments, links);
  const dirty = savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const hasTitle = title.trim().length > 0;

  // Refs synchronisées pour l'autosave (évite les closures périmées).
  const formRef = useRef({ title, contentHtml, tags, images, attachments, links });
  formRef.current = { title, contentHtml, tags, images, attachments, links };
  savedRef.current = savedSnapshot;

  const save = useCallback(
    async (status: NoteStatus, navigate: boolean): Promise<Note | null> => {
      const f = formRef.current;
      const trimmed = f.title.trim();
      if (!trimmed) {
        setSaveState("error");
        return null;
      }
      const payload: NoteInput = {
        title: trimmed,
        contentHtml: f.contentHtml,
        tags: f.tags,
        images: f.images,
        attachments: f.attachments,
        links: f.links,
        status,
      };
      setSaveState("saving");
      try {
        const id = idRef.current;
        const note = id
          ? await api.updateNote(id, payload)
          : await api.createNote(payload);
        idRef.current = note.id;
        statusRef.current = note.status;
        const snap = serialize(
          note.title,
          note.contentHtml,
          note.tags,
          note.images,
          note.attachments ?? [],
          note.links.map((l) => l.url),
        );
        setSavedSnapshot(snap);
        savedRef.current = snap;
        setSaveState("saved");
        if (navigate) router.push(status === "published" ? `/${note.id}` : "/");
        return note;
      } catch {
        setSaveState("error");
        return null;
      }
    },
    [router],
  );

  // Autosave : brouillon en création, statut courant en édition.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (submitting) return;
      const f = formRef.current;
      if (!f.title.trim()) return;
      if (savedRef.current === null) return; // pas encore initialisé (édition)
      const snap = serialize(f.title, f.contentHtml, f.tags, f.images, f.attachments, f.links);
      if (snap === savedRef.current) return; // rien à enregistrer
      void save(statusRef.current, false);
    }, LIMITS.autosaveMs);
    return () => window.clearInterval(timer);
  }, [save, submitting]);

  // Avertit avant de quitter l'onglet si des modifications sont en attente.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function handlePublish(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    await save("published", true);
    setSubmitting(false);
  }

  async function handleDraft() {
    if (submitting) return;
    setSubmitting(true);
    await save("draft", true);
    setSubmitting(false);
  }

  function handleCancel() {
    if (dirty && !window.confirm("Abandonner les modifications non enregistrées ?")) return;
    router.push("/");
  }

  // --- États de chargement / erreur (édition) ---
  if (isEdit && loadError) {
    const forbidden =
      loadError instanceof ApiClientError && loadError.status === 403;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" aria-hidden />
          <h1 className="text-lg font-semibold text-gray-900">
            {forbidden ? "Modification impossible" : "Note introuvable"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {forbidden
              ? "Vous n'êtes pas l'auteur de cette note ; vous ne pouvez pas la modifier."
              : "Cette note n'existe pas ou a été supprimée."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            Retour aux notes
          </button>
        </div>
      </div>
    );
  }

  if (isEdit && (isLoading || !loaded)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Chargement de la note…" />
      </div>
    );
  }

  const indicator =
    saveState === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enregistrement…
      </span>
    ) : saveState === "error" ? (
      <span className="inline-flex items-center gap-1.5 text-red-600">
        <AlertCircle className="h-4 w-4" aria-hidden /> Erreur d'enregistrement
      </span>
    ) : dirty ? (
      <span className="text-gray-400">Modifications non enregistrées</span>
    ) : saveState === "saved" || idRef.current ? (
      <span className="inline-flex items-center gap-1.5 text-green-600">
        <Check className="h-4 w-4" aria-hidden /> Enregistré
      </span>
    ) : null;

  return (
    <form onSubmit={handlePublish} className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Modifier la note" : "Nouvelle note"}
        </h1>
        <div aria-live="polite" className="text-sm">
          {indicator}
        </div>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div>
          <label htmlFor="note-title" className="mb-1 block text-sm font-medium text-gray-700">
            Titre
          </label>
          <input
            id="note-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.noteTitleMax}
            placeholder="Titre de la note"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {title.length}/{LIMITS.noteTitleMax}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contenu</label>
          <RichTextEditor value={contentHtml} onChange={setContentHtml} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Images</label>
          <ImageUploader images={images} onChange={setImages} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Documents</label>
          <DocumentUploader attachments={attachments} onChange={setAttachments} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Liens</label>
          <LinkManager links={links} onChange={setLinks} />
        </div>

        <div>
          <label htmlFor="note-tags" className="mb-1 block text-sm font-medium text-gray-700">
            Tags
          </label>
          <TagInput id="note-tags" value={tags} onChange={setTags} />
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 rounded-xl border border-gray-100 bg-white/90 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="rounded-lg px-4 py-2 font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleDraft}
          disabled={submitting || !hasTitle}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden /> Enregistrer en brouillon
        </button>
        <button
          type="submit"
          disabled={submitting || !hasTitle}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          Publier
        </button>
      </div>
    </form>
  );
}
