"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { NoteImage } from "@noteshare/shared";

interface LightboxProps {
  images: NoteImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}

/** Visionneuse plein écran : navigation prev/next (clic + flèches) et Échap. */
export function Lightbox({ images, index, onClose, onIndex }: LightboxProps) {
  const count = images.length;
  const hasNav = count > 1;

  const goPrev = useCallback(() => {
    if (count > 0) onIndex((index - 1 + count) % count);
  }, [index, count, onIndex]);

  const goNext = useCallback(() => {
    if (count > 0) onIndex((index + 1) % count);
  }, [index, count, onIndex]);

  // Navigation clavier + fermeture.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  // Verrouille le défilement de la page tant que la visionneuse est ouverte.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse d'images"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Fermer la visionneuse"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <X className="h-6 w-6" />
      </button>

      {hasNav && (
        <button
          type="button"
          aria-label="Image précédente"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:left-6"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={`Image ${index + 1} sur ${count}`}
        width={current.width}
        height={current.height}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl animate-scale-in"
      />

      {hasNav && (
        <button
          type="button"
          aria-label="Image suivante"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:right-6"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {hasNav && (
        <div
          aria-live="polite"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white"
        >
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}
