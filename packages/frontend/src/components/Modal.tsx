"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
} as const;

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: keyof typeof SIZE;
  className?: string;
  /** Classe du conteneur de contenu (par défaut sans marge interne). */
  contentClassName?: string;
  /** Masque le bouton de fermeture (×). */
  hideClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wrapper de modale générique : backdrop, fermeture (× / clic dehors / Échap),
 * `animate-scale-in`, verrouillage du scroll et piège à focus.
 */
export function Modal({
  onClose,
  children,
  title,
  size = "md",
  className,
  contentClassName,
  hideClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Verrouille le scroll de fond, focus initial, restaure le focus à la sortie.
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [mounted]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "scrollbar-thin relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl animate-scale-in focus:outline-none",
          SIZE[size],
          className,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {!hideClose && <CloseButton onClose={onClose} />}
          </div>
        ) : (
          !hideClose && (
            <div className="absolute right-3 top-3 z-10">
              <CloseButton onClose={onClose} />
            </div>
          )
        )}
        <div className={cn(title && "px-6 py-5", contentClassName)}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fermer"
      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
    >
      <X className="h-5 w-5" />
    </button>
  );
}
