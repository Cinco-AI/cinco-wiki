import type { FindNotesArgs } from "../notes-source.js";

export type PrefetchTool = "findNotes" | "topContributors" | "listTags";

export type ResolvedIntent =
  | { kind: "prefetch"; tool: "findNotes"; args: FindNotesArgs }
  | { kind: "prefetch"; tool: "topContributors"; args: { limit: number } }
  | { kind: "prefetch"; tool: "listTags"; args: Record<string, never> }
  | { kind: "auto"; hint?: "searchNotes" };

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function extractSinceDays(q: string): number | null {
  const dayMatch = q.match(
    /(?:il y a|depuis|last|past|within)\s+(\d+)\s*(?:jours?|days?)/i,
  );
  if (dayMatch) return Math.min(Math.max(1, Number(dayMatch[1])), 365);

  const onlyDays = q.match(
    /(\d+)\s*(?:jours?|days?)\s*(?:seulement|only|ago)?/i,
  );
  if (onlyDays && /note|recent|dernier|last|il y a|depuis/.test(q)) {
    return Math.min(Math.max(1, Number(onlyDays[1])), 365);
  }

  if (/\b(?:48\s*h|48h|deux jours|2 days)\b/i.test(q)) return 2;
  if (/\b(?:cette semaine|this week|7\s*jours|7 days)\b/i.test(q)) return 7;
  return null;
}

/**
 * Mappe la dernière question user → prefetch déterministe ou mode tools auto.
 * N’ajoute pas de tools : remplit seulement les args du catalogue fixe.
 */
export function resolveChatIntent(userMessage: string): ResolvedIntent {
  const q = normalize(userMessage);
  if (!q) return { kind: "auto" };

  if (
    /meilleur contributeur|top (?:des )?auteurs|qui (?:ecrit|publie|contribue) (?:le )?plus|who contributes|top contributors?|most (?:active )?authors?/.test(
      q,
    )
  ) {
    return {
      kind: "prefetch",
      tool: "topContributors",
      args: { limit: 10 },
    };
  }

  if (
    /liste (?:des |les )?tags|list(?:e)? tags|quels? tags|available tags|tous les tags/.test(
      q,
    )
  ) {
    return { kind: "prefetch", tool: "listTags", args: {} };
  }

  if (/youtube|youtu\.be/.test(q)) {
    return {
      kind: "prefetch",
      tool: "findNotes",
      args: {
        linkHost: "youtube.com",
        sort: "createdAt",
        limit: 20,
      },
    };
  }

  const sinceDays = extractSinceDays(q);
  if (
    sinceDays != null ||
    /notes? (?:recentes?|dernieres?)|recent notes?|latest notes?|dernieres? notes?/.test(
      q,
    )
  ) {
    return {
      kind: "prefetch",
      tool: "findNotes",
      args: {
        sinceDays: sinceDays ?? undefined,
        sort: "createdAt",
        limit: 20,
      },
    };
  }

  if (
    /mieux notees?|best rated|top rated|notes? (?:les )?mieux note/.test(q)
  ) {
    return {
      kind: "prefetch",
      tool: "findNotes",
      args: { sort: "avgRating", limit: 10 },
    };
  }

  if (/plus commentees?|most commented|top commented/.test(q)) {
    return {
      kind: "prefetch",
      tool: "findNotes",
      args: { sort: "commentCount", limit: 10 },
    };
  }

  // Sujets libres (apprentissage, techno, …) → searchNotes via tools auto
  return { kind: "auto", hint: "searchNotes" };
}
