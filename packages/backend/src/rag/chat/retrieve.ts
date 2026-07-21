import { isGraphConfigured, ragConfig } from "../config.js";
import {
  formatGraphContext,
  relatedNotes,
  type GraphNote,
} from "../graph/query.js";
import { getLlmProvider } from "../llm/index.js";
import type { CatalogType, SearchHit } from "../types.js";
import { searchSimilar } from "../vector/qdrant.js";

export async function retrieveNotes(
  query: string,
  options?: { limit?: number; type?: CatalogType },
): Promise<SearchHit[]> {
  const llm = getLlmProvider();
  const [vector] = await llm.embed([query]);
  if (!vector) return [];
  const hits = await searchSimilar(vector, {
    limit: options?.limit ?? ragConfig.topK,
    type: options?.type ?? "note",
  });
  return hits.filter((h) => h.score >= ragConfig.minScore);
}

/** Vector hits + Neo4j neighborhood for top note (GraphRAG). */
export async function retrieveNotesWithGraph(
  query: string,
  options?: { limit?: number; type?: CatalogType },
): Promise<{
  hits: SearchHit[];
  related: GraphNote[];
  edges: string[];
  graphContext: string;
}> {
  const hits = await retrieveNotes(query, options);
  if (!isGraphConfigured() || hits.length === 0) {
    return { hits, related: [], edges: [], graphContext: "" };
  }

  const seedId = String(hits[0]?.payload.noteId || "");
  if (!seedId) {
    return { hits, related: [], edges: [], graphContext: "" };
  }

  const neighborhood = await relatedNotes(seedId, 1);
  const graphContext = formatGraphContext({
    notes: neighborhood.notes,
    edges: neighborhood.edges,
  });
  return {
    hits,
    related: neighborhood.notes,
    edges: neighborhood.edges,
    graphContext,
  };
}
