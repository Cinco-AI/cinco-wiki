"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { IMAGE_MIME, LIMITS, type NoteImage } from "@noteshare/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface ImageUploaderProps {
  images: NoteImage[];
  onChange: (imgs: NoteImage[]) => void;
}

type ImageMime = (typeof IMAGE_MIME)[number];

function isImageMime(type: string): type is ImageMime {
  return (IMAGE_MIME as readonly string[]).includes(type);
}

/** Réassigne un `order` contigu (0..n-1) suivant la position dans le tableau. */
function reindex(imgs: NoteImage[]): NoteImage[] {
  return imgs.map((img, i) => ({ ...img, order: i }));
}

function formatBytes(n: number): string {
  const mb = n / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} Mo`;
}

export function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Affichage et opérations toujours triés par `order`.
  const ordered = [...images].sort((a, b) => a.order - b.order);
  const total = ordered.length + uploading;
  const isFull = total >= LIMITS.imagesPerNote;

  const uploadOne = useCallback(async (file: File): Promise<NoteImage> => {
    const contentType = file.type as ImageMime; // validé en amont
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
    return { url: publicUrl, order: 0 }; // `order` recalculé via reindex
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const accepted: File[] = [];
      const errs: string[] = [];
      let slots = LIMITS.imagesPerNote - total;

      for (const file of files) {
        if (slots <= 0) {
          errs.push(`« ${file.name} » : maximum ${LIMITS.imagesPerNote} images.`);
          continue;
        }
        if (!isImageMime(file.type)) {
          errs.push(`« ${file.name} » : format non pris en charge (JPEG, PNG, GIF, WebP).`);
          continue;
        }
        if (file.size > LIMITS.imageMaxBytes) {
          errs.push(`« ${file.name} » : dépasse ${formatBytes(LIMITS.imageMaxBytes)}.`);
          continue;
        }
        accepted.push(file);
        slots--;
      }

      if (accepted.length > 0) {
        setUploading((u) => u + accepted.length);
        const results = await Promise.allSettled(accepted.map(uploadOne));
        setUploading((u) => u - accepted.length);

        const ok: NoteImage[] = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") ok.push(r.value);
          else errs.push(`« ${accepted[i]?.name ?? "Image"} » : échec de l'envoi.`);
        });
        if (ok.length > 0) onChange(reindex([...ordered, ...ok]));
      }

      if (errs.length > 0) setError(errs.join(" "));
    },
    [ordered, total, onChange, uploadOne],
  );

  function openPicker() {
    inputRef.current?.click();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChange(reindex(next));
  }

  function remove(index: number) {
    onChange(reindex(ordered.filter((_, i) => i !== index)));
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
        aria-label="Ajouter des images : cliquez ou glissez-déposez vos fichiers"
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
          Glissez-déposez vos images ou{" "}
          <span className="text-brand-700 underline">parcourez</span>
        </span>
        <span className="text-xs text-gray-500">
          JPEG, PNG, GIF, WebP · {formatBytes(LIMITS.imageMaxBytes)} max ·{" "}
          {ordered.length}/{LIMITS.imagesPerNote}
        </span>
      </button>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={IMAGE_MIME.join(",")}
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

      {/* Grille de vignettes */}
      {(ordered.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {ordered.map((img, index) => (
            <li
              key={`${img.url}-${index}`}
              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="aspect-square w-full bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Badge ordre */}
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
                {index + 1}
              </span>

              {/* Supprimer */}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Supprimer l'image ${index + 1}`}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition hover:bg-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-200 group-hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              {/* Réordonner */}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Déplacer l'image ${index + 1} vers la gauche`}
                  className="rounded-md bg-white/90 p-1 text-gray-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4 -rotate-90" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === ordered.length - 1}
                  aria-label={`Déplacer l'image ${index + 1} vers la droite`}
                  className="rounded-md bg-white/90 p-1 text-gray-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}

          {/* Vignettes en cours d'envoi */}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`uploading-${i}`}
              className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400"
              aria-label="Envoi en cours"
            >
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </li>
          ))}

          {/* Tuile d'ajout rapide */}
          {!isFull && (
            <li>
              <button
                type="button"
                onClick={openPicker}
                aria-label="Ajouter des images"
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
                <span className="text-xs font-medium">Ajouter</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
