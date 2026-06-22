"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Corps du message (texte ou contenu riche). */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style destructeur (rouge) pour les actions irréversibles. */
  danger?: boolean;
  /** Action en cours : verrouille les boutons et affiche un spinner. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Boîte de confirmation générique — remplace `window.confirm`.
 * S'appuie sur `Modal` (backdrop, Échap, clic dehors, piège à focus).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal onClose={onCancel} title={title} size="sm">
      {message && <div className="text-sm text-gray-600">{message}</div>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 disabled:opacity-60",
            danger
              ? "bg-red-600 hover:bg-red-700 focus:ring-red-200"
              : "bg-brand-600 hover:bg-brand-700 focus:ring-brand-200",
          )}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
