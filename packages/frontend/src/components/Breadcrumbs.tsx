import Link from "next/link";
import { cn } from "@/lib/cn";

export interface Crumb {
  label: string;
  /** Lien de navigation ; omis pour la page courante (dernier élément). */
  href?: string;
}

/** Fil d'Ariane (§4) : navigation hiérarchique. Le dernier élément représente la page courante. */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Fil d'Ariane" className={cn("text-sm text-gray-500", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-x-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="transition hover:text-brand-700">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "text-gray-700" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-gray-300">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
