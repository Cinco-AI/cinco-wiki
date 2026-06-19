"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Garde d'auth : non connecté → page de connexion.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
