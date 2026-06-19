"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bell, Check, CheckCheck } from "lucide-react";
import type { Notification } from "@cinco-wiki/shared";
import { api } from "@/lib/api";
import { relativeDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/Spinner";

/** Cloche de notifications : badge non-lus + dropdown (§10.1). */
export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, mutate } = useSWR<Notification[]>(
    "notifications",
    () => api.listNotifications(),
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(n: Notification) {
    if (n.read) return;
    mutate(
      notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      { revalidate: false },
    );
    try {
      await api.markNotificationRead(n.id);
    } finally {
      mutate();
    }
  }

  async function markAll() {
    if (unread === 0) return;
    mutate(
      notifications.map((x) => ({ ...x, read: true })),
      { revalidate: false },
    );
    try {
      await api.markAllNotificationsRead();
    } finally {
      mutate();
    }
  }

  async function onSelect(n: Notification) {
    await markRead(n);
    if (n.noteId) {
      setOpen(false);
      router.push(`/${n.noteId}`);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-700 transition hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Aucune notification.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => onSelect(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50",
                        !n.read && "bg-brand-50/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-brand-500",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn("block text-sm text-gray-800", !n.read && "font-medium")}
                        >
                          {n.message}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-400">
                          {relativeDate(n.createdAt)}
                        </span>
                      </span>
                      {!n.read && (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
