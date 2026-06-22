"use client";

import { useEffect, useRef, useState } from "react";
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

/** Sélecteur d'emoji : bouton + popover groupé par catégorie. */
export function EmojiPicker({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur + touche Échap (cf. NotificationsBell).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Ajouter un emoji"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
      >
        <Smile className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sélecteur d'emoji"
          className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
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
        </div>
      )}
    </div>
  );
}
