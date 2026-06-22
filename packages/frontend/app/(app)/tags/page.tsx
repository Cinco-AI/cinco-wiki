"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Tags } from "lucide-react";
import { api } from "@/lib/api";
import { TagBadge } from "@/components/TagBadge";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { Breadcrumbs } from "@/components/Breadcrumbs";

/** Nuage de tags (§4) : taille proportionnelle au nombre de notes, cliquable → /tags/:tag. */
export default function TagsPage() {
  const router = useRouter();
  const { data: tags, error, isLoading } = useSWR(["tags"], () => api.listTags());

  // Tri par fréquence décroissante + bornes pour l'échelle d'affichage.
  const sorted = useMemo(
    () => [...(tags ?? [])].sort((a, b) => b.count - a.count),
    [tags],
  );
  const [min, max] = useMemo(() => {
    if (!sorted.length) return [0, 0];
    const counts = sorted.map((t) => t.count);
    return [Math.min(...counts), Math.max(...counts)];
  }, [sorted]);

  // Échelle 0.9 → 1.8 selon le count (constante si toutes les valeurs sont égales).
  function scaleFor(count: number): number {
    if (max === min) return 1;
    return 0.9 + ((count - min) / (max - min)) * 0.9;
  }

  return (
    <section
      aria-label="Nuage de tags"
      className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <header className="mb-6">
        <Breadcrumbs
          className="mb-2"
          items={[{ label: "Accueil", href: "/" }, { label: "Tags" }]}
        />
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explorez les notes par thème. La taille reflète le nombre de notes.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20" aria-live="polite">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          title="Impossible de charger les tags"
          description="Une erreur est survenue. Réessayez dans un instant."
          icon={Tags}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Aucun tag"
          description="Les tags apparaîtront ici dès que des notes en seront pourvues."
          icon={Tags}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
          {sorted.map((tag) => (
            <span
              key={tag.name}
              className="inline-flex origin-center"
              style={{ fontSize: `${scaleFor(tag.count)}rem` }}
              title={`${tag.count} note${tag.count > 1 ? "s" : ""}`}
            >
              <TagBadge
                tag={tag.name}
                onClick={(t) => router.push(`/tags/${encodeURIComponent(t)}`)}
              />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
