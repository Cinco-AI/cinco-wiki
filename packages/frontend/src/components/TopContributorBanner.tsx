"use client";

import useSWR from "swr";
import { FileText, MessageSquare, Star, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { fullName } from "@/lib/format";

interface TopContributorBannerProps {
  onSelectAuthor?: (authorId: string) => void;
}

/** Mise en avant du contributeur avec le plus de notes publiées. */
export function TopContributorBanner({ onSelectAuthor }: TopContributorBannerProps) {
  const { data, isLoading } = useSWR(["top-contributor"], () => api.getTopContributor());

  if (isLoading || !data) return null;

  const stats = [
    { label: "Notes", value: data.stats.notesCount, icon: FileText },
    { label: "Commentaires", value: data.stats.commentsCount, icon: MessageSquare },
    { label: "Votes", value: data.stats.votesCount, icon: Star },
  ];

  const Wrapper = onSelectAuthor ? "button" : "div";
  const wrapperProps = onSelectAuthor
    ? {
        type: "button" as const,
        onClick: () => onSelectAuthor(data.user.id),
        className:
          "group flex w-full flex-col gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200 sm:flex-row sm:items-center sm:justify-between",
      }
    : {
        className:
          "flex w-full flex-col gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
      };

  return (
    <aside aria-label="Meilleur contributeur" className="mb-8">
      <Wrapper {...wrapperProps}>
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
            aria-hidden="true"
          >
            <Trophy className="h-6 w-6" />
          </div>
          <Avatar user={data.user} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Meilleur contributeur
            </p>
            <p className="truncate text-lg font-bold text-gray-900">{fullName(data.user)}</p>
            {onSelectAuthor && (
              <p className="text-sm text-gray-500 transition group-hover:text-brand-600">
                Voir ses notes
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-center"
            >
              <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
              <span className="text-lg font-bold tabular-nums text-gray-900">{value}</span>
              <span className="text-[11px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </Wrapper>
    </aside>
  );
}
