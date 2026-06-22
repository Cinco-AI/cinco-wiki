"use client";

import { use } from "react";
import { NotesDashboard } from "@/components/NotesDashboard";
import { Breadcrumbs } from "@/components/Breadcrumbs";

/** Notes filtrées par tag (§4) : titre + tableau de bord préfiltré. */
export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);
  const decoded = decodeURIComponent(tag);

  return (
    <>
      <header className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Accueil", href: "/" },
            { label: "Tags", href: "/tags" },
            { label: `#${decoded}` },
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          Notes taguées <span className="text-brand-600">#{decoded}</span>
        </h1>
      </header>
      <NotesDashboard initialTag={decoded} />
    </>
  );
}
