import { tool } from "ai";
import type { Db } from "mongodb";
import { z } from "zod";
import {
  authorsByTag,
  findNotes,
  getNote,
  graphPath,
  listTags,
  mostCommentedNotes,
  noteComments,
  noteRatings,
  notesByAuthor,
  notesBySharedTags,
  notesCommentedByUser,
  notesRatedByUser,
  relatedNotes,
  searchNotes,
  topContributors,
  topRatedNotes,
} from "../catalog/tools.js";
import { ragConfig } from "../config.js";

async function softGraphTool<T extends object>(
  name: string,
  fn: () => Promise<T>,
  empty: T,
): Promise<T | (T & { ok: false; error: string })> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[rag] tool ${name}: ${message}`);
    return { ...empty, ok: false as const, error: "GRAPH_UNAVAILABLE" };
  }
}

export function createChatTools(db: Db, _locale?: string | null) {
  return {
    searchNotes: tool({
      description:
        "Recherche sémantique dans les notes publiées de Cinco Wiki.",
      parameters: z.object({
        query: z
          .string()
          .describe("Terme ou question de recherche dans les notes"),
      }),
      execute: async ({ query }) =>
        searchNotes({
          query,
          limit: ragConfig.topK,
        }),
    }),

    getNote: tool({
      description:
        "Récupère le contenu d'une note par id Mongo ou par titre approximatif.",
      parameters: z.object({
        noteIdOrTitle: z
          .string()
          .describe("ID de note (ObjectId) ou titre"),
      }),
      execute: async ({ noteIdOrTitle }) => getNote(db, { noteIdOrTitle }),
    }),

    listTags: tool({
      description:
        "Liste les tags disponibles dans le wiki (pour affiner une recherche).",
      parameters: z.object({
        includeAll: z
          .boolean()
          .describe("Toujours true — liste les tags"),
      }),
      execute: async () => listTags(db),
    }),

    findNotes: tool({
      description:
        "Liste des notes publiées avec filtres structurés (Mongo). Utiliser pour : notes récentes / depuis N jours, notes avec lien YouTube (ou autre host), tri par date / note / commentaires. Pas pour un sujet sémantique (préférer searchNotes).",
      parameters: z.object({
        sinceDays: z
          .number()
          .nullable()
          .describe("Notes créées dans les N derniers jours (ex. 2)"),
        linkHost: z
          .string()
          .nullable()
          .describe(
            "Filtrer par domaine de lien (ex. youtube.com ; youtu.be inclus côté serveur)",
          ),
        sort: z
          .enum(["createdAt", "avgRating", "commentCount"])
          .nullable()
          .describe("Tri (défaut createdAt)"),
        limit: z.number().nullable().describe("Nombre max (défaut 20)"),
      }),
      execute: async ({ sinceDays, linkHost, sort, limit }) =>
        findNotes(db, {
          sinceDays: sinceDays ?? undefined,
          linkHost: linkHost ?? undefined,
          sort: sort ?? "createdAt",
          limit: limit ?? 20,
        }),
    }),

    topContributors: tool({
      description:
        "Classement des contributeurs (auteurs) par nombre de notes publiées. Utiliser pour : meilleur contributeur, qui écrit/publie le plus, top auteurs.",
      parameters: z.object({
        limit: z.number().nullable().describe("Nombre max (défaut 10)"),
      }),
      execute: async ({ limit }) =>
        topContributors(db, { limit: limit ?? 10 }),
    }),

    relatedNotes: tool({
      description:
        "Notes liées dans le graphe Neo4j (tags, auteur, liens internes).",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note seed"),
        depth: z
          .number()
          .nullable()
          .describe("Profondeur 1 ou 2 (défaut 1)"),
      }),
      execute: async ({ noteIdOrTitle, depth }) =>
        softGraphTool(
          "relatedNotes",
          () =>
            relatedNotes({
              noteIdOrTitle,
              depth: depth ?? 1,
            }),
          { found: false, seed: null, notes: [], edges: [] },
        ),
    }),

    notesBySharedTags: tool({
      description:
        "Notes partageant des tags avec une note donnée (graphe Neo4j).",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note seed"),
        limit: z.number().nullable().describe("Nombre max de notes"),
      }),
      execute: async ({ noteIdOrTitle, limit }) =>
        softGraphTool(
          "notesBySharedTags",
          () =>
            notesBySharedTags({
              noteIdOrTitle,
              limit: limit ?? 10,
            }),
          { found: false, seed: null, notes: [] },
        ),
    }),

    graphPath: tool({
      description:
        "Plus court chemin dans le graphe entre deux notes (via tags/liens/users).",
      parameters: z.object({
        from: z.string().describe("Note de départ (id ou titre)"),
        to: z.string().describe("Note d'arrivée (id ou titre)"),
      }),
      execute: async ({ from, to }) =>
        softGraphTool(
          "graphPath",
          () => graphPath({ from, to }),
          { found: false, path: [], notes: [] },
        ),
    }),

    topRatedNotes: tool({
      description: "Notes les mieux notées (avgRating / votes).",
      parameters: z.object({
        limit: z.number().nullable().describe("Nombre max (défaut 10)"),
        tag: z.string().nullable().describe("Filtrer par tag (optionnel)"),
      }),
      execute: async ({ limit, tag }) =>
        softGraphTool(
          "topRatedNotes",
          () =>
            topRatedNotes({
              limit: limit ?? 10,
              tag: tag ?? undefined,
            }),
          { notes: [] },
        ),
    }),

    mostCommentedNotes: tool({
      description: "Notes les plus commentées.",
      parameters: z.object({
        limit: z.number().nullable().describe("Nombre max (défaut 10)"),
      }),
      execute: async ({ limit }) =>
        softGraphTool(
          "mostCommentedNotes",
          () => mostCommentedNotes({ limit: limit ?? 10 }),
          { notes: [] },
        ),
    }),

    notesByAuthor: tool({
      description: "Notes publiées par un auteur (nom ou id).",
      parameters: z.object({
        nameOrId: z.string().describe("Prénom, nom complet ou id user"),
      }),
      execute: async ({ nameOrId }) =>
        softGraphTool(
          "notesByAuthor",
          () => notesByAuthor({ nameOrId }),
          { found: false, author: null, notes: [] },
        ),
    }),

    noteRatings: tool({
      description: "Détail des notes/votes sur une note wiki.",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note"),
      }),
      execute: async ({ noteIdOrTitle }) =>
        softGraphTool(
          "noteRatings",
          () => noteRatings({ noteIdOrTitle }),
          {
            found: false,
            note: null,
            avgRating: 0,
            voteCount: 0,
            ratings: [],
          },
        ),
    }),

    notesRatedByUser: tool({
      description: "Notes auxquelles un utilisateur a attribué une note.",
      parameters: z.object({
        nameOrId: z.string().describe("Nom ou id utilisateur"),
        minValue: z
          .number()
          .nullable()
          .describe("Note minimale 1..5 (défaut 1)"),
      }),
      execute: async ({ nameOrId, minValue }) =>
        softGraphTool(
          "notesRatedByUser",
          () =>
            notesRatedByUser({
              nameOrId,
              minValue: minValue ?? 1,
            }),
          { found: false, user: null, notes: [] },
        ),
    }),

    noteComments: tool({
      description: "Commentaires (aperçu) sur une note.",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note"),
        limit: z.number().nullable().describe("Nombre max (défaut 20)"),
      }),
      execute: async ({ noteIdOrTitle, limit }) =>
        softGraphTool(
          "noteComments",
          () =>
            noteComments({
              noteIdOrTitle,
              limit: limit ?? 20,
            }),
          { found: false, note: null, comments: [] },
        ),
    }),

    notesCommentedByUser: tool({
      description: "Notes sur lesquelles un utilisateur a commenté.",
      parameters: z.object({
        nameOrId: z.string().describe("Nom ou id utilisateur"),
      }),
      execute: async ({ nameOrId }) =>
        softGraphTool(
          "notesCommentedByUser",
          () => notesCommentedByUser({ nameOrId }),
          { found: false, user: null, notes: [] },
        ),
    }),

    authorsByTag: tool({
      description: "Auteurs ayant publié des notes avec un tag donné.",
      parameters: z.object({
        tag: z.string().describe("Nom du tag"),
      }),
      execute: async ({ tag }) =>
        softGraphTool(
          "authorsByTag",
          () => authorsByTag({ tag }),
          { tag, authors: [] },
        ),
    }),
  };
}
