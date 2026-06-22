"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TagManagementTable } from "@/components/TagManagementTable";

export default function AdminTagsPage() {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={ShieldCheck}
          title="Accès réservé"
          description="Cette section est réservée aux administrateurs."
          action={
            <Link
              href="/"
              className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
            >
              Retour à l'accueil
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Accueil", href: "/" },
            { label: "Administration", href: "/admin" },
            { label: "Tags" },
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">Gestion des tags</h1>
      </header>

      <TagManagementTable />
    </main>
  );
}
