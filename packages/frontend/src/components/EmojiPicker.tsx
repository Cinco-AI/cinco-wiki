"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { cn } from "@/lib/cn";

/** Jeux d'emojis regroupés par catégorie pour le sélecteur de commentaires. */
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Visages",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "😘", "😗", "😋", "😛", "😜",
      "🤪", "😎", "🤓", "🥳", "😏", "🤩", "🤔", "🤨", "😐", "😶",
      "🙄", "😴", "🤐", "😬", "😳", "🥺", "😢", "😭", "😤", "😡",
    ],
  },
  {
    label: "Gestes",
    emojis: [
      "👍", "👎", "👏", "🙌", "👌", "🤌", "✌️", "🤞", "🤟", "🤘",
      "👋", "🤙", "💪", "🙏", "🤝", "👀", "🫶", "🫡", "🤷", "🤦",
    ],
  },
  {
    label: "Cœurs",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💗",
      "💕", "💔", "❣️", "💯", "💫", "⭐", "🌟", "✨", "🔥", "🎉",
    ],
  },
  {
    label: "Objets",
    emojis: [
      "✅", "❌", "⚠️", "❓", "❗", "💡", "📌", "📎", "🔗", "📝",
      "🚀", "🎯", "🏆", "👑", "💰", "☕", "🍕", "🎂", "🐛", "👻",
    ],
  },
];

const POPOVER_WIDTH = 256;
const GAP = 8;

/** Sélecteur d'emoji : bouton + popover groupé par catégorie. */
export function EmojiPicker({
  onSelect,
  className,
  align = "start",
}: {
  onSelect: (emoji: string) => void;
  className?: string;
  /** Alignement horizontal du popover par rapport au bouton déclencheur. */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "top" as "top" | "bottom" });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const popoverHeight = popover?.offsetHeight ?? 240;
    const rawLeft = align === "end" ? rect.right - POPOVER_WIDTH : rect.left;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - POPOVER_WIDTH - 8));
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement =
      spaceAbove >= popoverHeight + GAP || spaceAbove >= spaceBelow ? "top" : "bottom";

    setCoords({
      top: placement === "top" ? rect.top - GAP : rect.bottom + GAP,
      left,
      placement,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Recalcule une fois le popover monté (hauteur réelle).
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, group, updatePosition]);

  // Fermeture au clic extérieur + touche Échap (cf. NotificationsBell).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const popover =
    open && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Sélecteur d'emoji"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
              zIndex: 60,
            }}
            className="w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          >
            <div className="mb-1.5 flex gap-1 border-b border-gray-100 pb-1.5">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => setGroup(i)}
                  className={cn(
                    "flex-1 rounded-md px-1 py-1 text-xs font-medium transition",
                    i === group
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-500 hover:bg-gray-100",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
              {(EMOJI_GROUPS[group]?.emojis ?? []).map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                  aria-label={`Insérer ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Ajouter un emoji"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
      >
        <Smile className="h-5 w-5" aria-hidden="true" />
      </button>
      {popover}
    </div>
  );
}
