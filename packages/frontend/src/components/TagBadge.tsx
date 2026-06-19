"use client";

import { cn } from "@/lib/cn";

interface TagBadgeProps {
  tag: string;
  onClick?: (tag: string) => void;
  active?: boolean;
}

/** Badge de tag cliquable → filtre (§4.2). */
export function TagBadge({ tag, onClick, active = false }: TagBadgeProps) {
  const className = cn(
    "inline-flex max-w-[12rem] items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium transition",
    active
      ? "bg-brand-500 text-white"
      : "bg-brand-50 text-brand-700",
    onClick &&
      "cursor-pointer hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
    onClick && active && "hover:bg-brand-600",
  );

  if (!onClick) {
    return <span className={className}>#{tag}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(tag)}
      aria-pressed={active}
      className={className}
    >
      #{tag}
    </button>
  );
}
