"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  LogOut,
  Menu,
  Plus,
  Search,
  Shield,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fullName } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { NotificationsBell } from "@/components/NotificationsBell";

/** Barre de navigation principale de l'app (§10.1). */
export function NavBar() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture du menu compte au clic extérieur + Échap.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
    setMobileOpen(false);
  }

  function onLogout() {
    setMenuOpen(false);
    setMobileOpen(false);
    logout();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6"
        aria-label="Navigation principale"
      >
        <Link
          href="/"
          className="shrink-0 rounded-lg text-xl font-bold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        >
          Note<span className="text-brand-600">Share</span>
        </Link>

        {/* Recherche globale (desktop) */}
        <form onSubmit={onSearch} role="search" className="relative hidden flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher des notes…"
            aria-label="Rechercher des notes"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </form>

        {/* Actions (desktop) */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link
            href="/notes/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle note
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Admin
            </Link>
          )}

          <NotificationsBell />

          {/* Menu du compte */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu du compte"
              className="flex items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <Avatar user={user} size="sm" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Menu du compte"
                className="absolute right-0 z-50 mt-2 w-56 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
              >
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-gray-900">{fullName(user)}</p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="py-1">
                  <MenuLink href="/profil" icon={User} onSelect={() => setMenuOpen(false)}>
                    Mon profil
                  </MenuLink>
                  <MenuLink href="/?mine" icon={FileText} onSelect={() => setMenuOpen(false)}>
                    Mes notes
                  </MenuLink>
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions (mobile) */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <NotificationsBell />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="navbar-mobile-menu"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Panneau mobile */}
      {mobileOpen && (
        <div
          id="navbar-mobile-menu"
          className="animate-fade-in border-t border-gray-100 bg-white px-4 py-3 md:hidden"
        >
          <form onSubmit={onSearch} role="search" className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher des notes…"
              aria-label="Rechercher des notes"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </form>

          <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{fullName(user)}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col py-1">
            <MobileLink href="/notes/new" icon={Plus} onSelect={() => setMobileOpen(false)}>
              Nouvelle note
            </MobileLink>
            <MobileLink href="/?mine" icon={FileText} onSelect={() => setMobileOpen(false)}>
              Mes notes
            </MobileLink>
            <MobileLink href="/profil" icon={User} onSelect={() => setMobileOpen(false)}>
              Mon profil
            </MobileLink>
            {isAdmin && (
              <MobileLink href="/admin" icon={Shield} onSelect={() => setMobileOpen(false)}>
                Admin
              </MobileLink>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  onSelect,
  children,
}: {
  href: string;
  icon: LucideIcon;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onSelect}
      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
    >
      <Icon className="h-4 w-4 text-gray-400" aria-hidden />
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  icon: Icon,
  onSelect,
  children,
}: {
  href: string;
  icon: LucideIcon;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
    >
      <Icon className="h-4 w-4 text-gray-400" aria-hidden />
      {children}
    </Link>
  );
}
