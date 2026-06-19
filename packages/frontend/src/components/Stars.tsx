"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { roundHalf } from "@/lib/format";
import { cn } from "@/lib/cn";

interface StarsProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (v: number) => void;
  myVote?: number | null;
}

const SIZE: Record<NonNullable<StarsProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/**
 * Étoiles de notation (§8.3).
 * - Lecture seule : moyenne arrondie au 0.5 (demi-étoiles via `roundHalf`).
 * - Interactif : survol + clic, vote courant (`myVote`) mis en évidence en `brand-500`.
 */
export function Stars({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onRate,
  myVote = null,
}: StarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const sizeClass = SIZE[size];

  if (interactive) {
    const current = hover ?? myVote ?? 0;
    return (
      <div
        role="radiogroup"
        aria-label="Votre note"
        className="inline-flex items-center gap-0.5"
      >
        {Array.from({ length: max }, (_, i) => {
          const v = i + 1;
          const filled = v <= current;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={myVote === v}
              aria-label={`Noter ${v} étoile${v > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(null)}
              onClick={() => onRate?.(v)}
              className="rounded transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <Star
                className={cn(sizeClass, filled ? "text-brand-500" : "text-gray-300")}
                fill={filled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // Lecture seule : demi-étoiles.
  const rounded = roundHalf(value);
  return (
    <div
      role="img"
      aria-label={`Note ${rounded} sur ${max}`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, rounded - i)); // 0 | 0.5 | 1
        return (
          <span key={i} className={cn("relative inline-block", sizeClass)}>
            <Star className={cn(sizeClass, "text-gray-300")} fill="none" />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(sizeClass, "text-brand-500")} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
