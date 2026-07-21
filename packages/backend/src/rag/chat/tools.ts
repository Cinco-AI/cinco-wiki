import { tool } from "ai";
import type { Db } from "mongodb";
import { z } from "zod";
import {
  authorsByTag,
  getNote,
  graphPath,
  listRecentNotes,
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
  topRatedNotes,
} from "../catalog/tools.js";
import { ragConfig } from "../config.js";

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

    listRecentNotes: tool({
      description:
        "Liste un échantillon de notes indexées (titres) pour explorer le corpus.",
      parameters: z.object({
        includeAll: z
          .boolean()
          .describe("Toujours true — liste des notes"),
      }),
      execute: async () => listRecentNotes(),
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
        relatedNotes({
          noteIdOrTitle,
          depth: depth ?? 1,
        }),
    }),

    notesBySharedTags: tool({
      description:
        "Notes partageant des tags avec une note donnée (graphe Neo4j).",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note seed"),
        limit: z.number().nullable().describe("Nombre max de notes"),
      }),
      execute: async ({ noteIdOrTitle, limit }) =>
        notesBySharedTags({
          noteIdOrTitle,
          limit: limit ?? 10,
        }),
    }),

    graphPath: tool({
      description:
        "Plus court chemin dans le graphe entre deux notes (via tags/liens/users).",
      parameters: z.object({
        from: z.string().describe("Note de départ (id ou titre)"),
        to: z.string().describe("Note d'arrivée (id ou titre)"),
      }),
      execute: async ({ from, to }) => graphPath({ from, to }),
    }),

    topRatedNotes: tool({
      description: "Notes les mieux notées (avgRating / votes).",
      parameters: z.object({
        limit: z.number().nullable().describe("Nombre max (défaut 10)"),
        tag: z.string().nullable().describe("Filtrer par tag (optionnel)"),
      }),
      execute: async ({ limit, tag }) =>
        topRatedNotes({
          limit: limit ?? 10,
          tag: tag ?? undefined,
        }),
    }),

    mostCommentedNotes: tool({
      description: "Notes les plus commentées.",
      parameters: z.object({
        limit: z.number().nullable().describe("Nombre max (défaut 10)"),
      }),
      execute: async ({ limit }) =>
        mostCommentedNotes({ limit: limit ?? 10 }),
    }),

    notesByAuthor: tool({
      description: "Notes publiées par un auteur (nom ou id).",
      parameters: z.object({
        nameOrId: z.string().describe("Prénom, nom complet ou id user"),
      }),
      execute: async ({ nameOrId }) => notesByAuthor({ nameOrId }),
    }),

    noteRatings: tool({
      description: "Détail des notes/votes sur une note wiki.",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note"),
      }),
      execute: async ({ noteIdOrTitle }) => noteRatings({ noteIdOrTitle }),
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
        notesRatedByUser({
          nameOrId,
          minValue: minValue ?? 1,
        }),
    }),

    noteComments: tool({
      description: "Commentaires (aperçu) sur une note.",
      parameters: z.object({
        noteIdOrTitle: z.string().describe("ID ou titre de la note"),
        limit: z.number().nullable().describe("Nombre max (défaut 20)"),
      }),
      execute: async ({ noteIdOrTitle, limit }) =>
        noteComments({
          noteIdOrTitle,
          limit: limit ?? 20,
        }),
    }),

    notesCommentedByUser: tool({
      description: "Notes sur lesquelles un utilisateur a commenté.",
      parameters: z.object({
        nameOrId: z.string().describe("Nom ou id utilisateur"),
      }),
      execute: async ({ nameOrId }) => notesCommentedByUser({ nameOrId }),
    }),

    authorsByTag: tool({
      description: "Auteurs ayant publié des notes avec un tag donné.",
      parameters: z.object({
        tag: z.string().describe("Nom du tag"),
      }),
      execute: async ({ tag }) => authorsByTag({ tag }),
    }),
  };
}
