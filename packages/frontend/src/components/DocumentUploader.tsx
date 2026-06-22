"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  AlertCircle,
  FileArchive,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Loader2,
  Paperclip,
  UploadCloud,
  X,
} from "lucide-react";
import { DOCUMENT_MIME, LIMITS, type NoteAttachment } from "@cinco-wiki/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface DocumentUploaderProps {
  attachments: NoteAttachment[];
  onChange: (files: NoteAttachment[]) => void;
}

type DocumentMime = (typeof DOCUMENT_MIME)[number];

function isDocumentMime(type: string): type is DocumentMime {
  return (DOCUMENT_MIME as readonly string[]).includes(type);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} Ko`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} Mo`;
}

/** Icône en fonction du type MIME du document. */
function iconFor(type: string) {
  if (type === "application/pdf") return FileText;
  if (type.includes("spreadsheet") || type === "application/vnd.ms-excel" || type === "text/csv")
    return FileSpreadsheet;
  if (type.includes("zip")) return FileArchive;
  if (type.startsWith("text/")) return FileText;
  return FileIcon;
}

export function DocumentUploader({ attachments, onChange }: DocumentUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const total = attachments.length + uploading;
  const isFull = total >= LIMITS.attachmentsPerNote;

  const uploadOne = useCallback(async (file: File): Promise<NoteAttachment> => {
    const contentType = file.type as DocumentMime; // validé en amont
    const { uploadUrl, publicUrl } = await api.presignUpload({
      filename: file.name,
      contentType,
      size: file.size,
    });
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    return { url: publicUrl, name: file.name, size: file.size, contentType };
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const accepted: File[] = [];
      const errs: string[] = [];
      let slots = LIMITS.attachmentsPerNote - total;

      for (const file of files) {
        if (slots <= 0) {
          errs.push(`« ${file.name} » : maximum ${LIMITS.attachmentsPerNote} documents.`);
          continue;
        }
        if (!isDocumentMime(file.type)) {
          errs.push(`« ${file.name} » : format non pris en charge.`);
          continue;
        }
        if (file.size > LIMITS.attachmentMaxBytes) {
          errs.push(`« ${file.name} » : dépasse ${formatBytes(LIMITS.attachmentMaxBytes)}.`);
          continue;
        }
        accepted.push(file);
        slots--;
      }

      if (accepted.length > 0) {
        setUploading((u) => u + accepted.length);
        const results = await Promise.allSettled(accepted.map(uploadOne));
        setUploading((u) => u - accepted.length);

        const ok: NoteAttachment[] = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") ok.push(r.value);
          else errs.push(`« ${accepted[i]?.name ?? "Document"} » : échec de l'envoi.`);
        });
        if (ok.length > 0) onChange([...attachments, ...ok]);
      }

      if (errs.length > 0) setError(errs.join(" "));
    },
    [attachments, total, onChange, uploadOne],
  );

  function openPicker() {
    inputRef.current?.click();
  }

  function remove(index: number) {
    onChange(attachments.filter((_, i) => i !== index));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {/* Zone de dépôt */}
      <button
        type="button"
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        aria-label="Ajouter des documents : cliquez ou glissez-déposez vos fichiers"
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition focus:outline-none focus:ring-2 focus:ring-brand-200",
          dragActive
            ? "border-brand-500 bg-brand-50"
            : "border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/60",
        )}
      >
        <span
          className={cn(
            "rounded-full p-3 transition",
            dragActive ? "bg-brand-100 text-brand-700" : "bg-white text-brand-600 shadow-sm",
          )}
        >
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-gray-700">
          Glissez-déposez vos documents ou{" "}
          <span className="text-brand-700 underline">parcourez</span>
        </span>
        <span className="text-xs text-gray-500">
          PDF, Word, Excel, PowerPoint, texte, ZIP · {formatBytes(LIMITS.attachmentMaxBytes)} max ·{" "}
          {attachments.length}/{LIMITS.attachmentsPerNote}
        </span>
      </button>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={DOCUMENT_MIME.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Message d'erreur de validation / d'envoi */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Liste des documents */}
      {(attachments.length > 0 || uploading > 0) && (
        <ul className="space-y-2">
          {attachments.map((file, index) => {
            const Icon = iconFor(file.contentType);
            return (
              <li
                key={`${file.url}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-gray-900 hover:text-brand-700 hover:underline"
                  >
                    {file.name}
                  </a>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Supprimer « ${file.name} »`}
                  className="shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}

          {/* Lignes en cours d'envoi */}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`uploading-${i}`}
              className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-gray-400"
              aria-label="Envoi en cours"
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="text-sm">Envoi en cours…</span>
            </li>
          ))}
        </ul>
      )}

      {/* Bouton d'ajout rapide quand des fichiers sont déjà présents */}
      {!isFull && (attachments.length > 0 || uploading > 0) && (
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          Ajouter un document
        </button>
      )}
    </div>
  );
}
