import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Libellé accessible (visuellement masqué). */
  label?: string;
}

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

/** Indicateur de chargement (primitive partagée). */
export function Spinner({ size = "md", className, label = "Chargement…" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center justify-center">
      <Loader2 className={cn("animate-spin text-brand-500", SIZE[size], className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
