"use client";

import Link from "next/link";
import { Users, ShieldCheck, Tags } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function AdminPage() {
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <Breadcrumbs
          className="mb-2"
          items={[{ label: "Accueil", href: "/" }, { label: "Administration" }]}
        />
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez les comptes et les paramètres de Cinco Wiki.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/utilisateurs"
          className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <span className="rounded-lg bg-brand-50 p-3 text-brand-600">
            <Users className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-semibold text-gray-900 group-hover:text-brand-700">
              Utilisateurs
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              Créer, modifier, désactiver ou supprimer des comptes.
            </span>
          </span>
        </Link>

        <Link
          href="/admin/tags"
          className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <span className="rounded-lg bg-brand-50 p-3 text-brand-600">
            <Tags className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-semibold text-gray-900 group-hover:text-brand-700">
              Tags
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              Renommer, fusionner ou supprimer des tags.
            </span>
          </span>
        </Link>
      </div>
    </main>
  );
}
