import { QdrantClient } from "@qdrant/js-client-rest";
import { v5 as uuidv5 } from "uuid";
import { ragConfig } from "../config.js";
import type { CatalogDocument, CatalogType, SearchHit } from "../types.js";

const POINT_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

let client: QdrantClient | null = null;

/**
 * @qdrant/js-client-rest defaults `port` to 6333 when URL has no explicit port.
 * For HTTPS reverse proxies (Traefik/Cloudflare on 443), that causes connect timeouts.
 * Pass `port: null` so the client uses the scheme default (443).
 * See https://github.com/qdrant/qdrant-js/issues/59
 */
function buildQdrantClientOptions(url: string, apiKey?: string) {
  const parsed = new URL(url);
  const explicitPort = parsed.port !== "" ? Number(parsed.port) : undefined;
  const fallbackPort = parsed.protocol === "https:" ? null : 6333;

  return {
    url,
    port: explicitPort ?? fallbackPort,
    // Remote / reverse-proxy often fails the version probe of js-client 1.18+
    checkCompatibility: false,
    ...(apiKey ? { apiKey } : {}),
  };
}

export function getQdrantClient(): QdrantClient {
  if (!client) {
    if (!ragConfig.qdrantUrl) {
      throw new Error("QDRANT_URL is not set");
    }
    client = new QdrantClient(
      buildQdrantClientOptions(
        ragConfig.qdrantUrl,
        ragConfig.qdrantApiKey || undefined,
      ),
    );
  }
  return client;
}

export function pointIdFor(type: CatalogType, entityId: string): string {
  return uuidv5(`${type}:${entityId}`, POINT_NAMESPACE);
}

export async function ensureCollection(): Promise<void> {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === ragConfig.qdrantCollection,
  );
  if (!exists) {
    await qdrant.createCollection(ragConfig.qdrantCollection, {
      vectors: {
        size: ragConfig.embeddingDimensions,
        distance: "Cosine",
      },
    });
    await qdrant.createPayloadIndex(ragConfig.qdrantCollection, {
      field_name: "type",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(ragConfig.qdrantCollection, {
      field_name: "noteId",
      field_schema: "keyword",
    });
  }
}

export async function collectionPointCount(): Promise<number> {
  const qdrant = getQdrantClient();
  try {
    const info = await qdrant.getCollection(ragConfig.qdrantCollection);
    return info.points_count ?? 0;
  } catch {
    return 0;
  }
}

export async function upsertDocuments(
  documents: CatalogDocument[],
  vectors: number[][],
): Promise<void> {
  if (documents.length === 0) return;
  const qdrant = getQdrantClient();
  await qdrant.upsert(ragConfig.qdrantCollection, {
    wait: true,
    points: documents.map((doc, i) => ({
      id: doc.pointId,
      vector: vectors[i]!,
      payload: {
        type: doc.type,
        text: doc.text,
        ...doc.payload,
      },
    })),
  });
}

const SCROLL_PAGE_SIZE = 256;
const DELETE_CHUNK_SIZE = 256;

export async function listAllPointIds(): Promise<string[]> {
  const qdrant = getQdrantClient();
  const ids: string[] = [];
  let offset: string | number | Record<string, unknown> | undefined;

  for (;;) {
    const result = await qdrant.scroll(ragConfig.qdrantCollection, {
      limit: SCROLL_PAGE_SIZE,
      with_payload: false,
      with_vector: false,
      offset,
    });

    for (const point of result.points) {
      ids.push(String(point.id));
    }

    if (result.next_page_offset == null) break;
    offset = result.next_page_offset as typeof offset;
  }

  return ids;
}

export async function deletePointsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const qdrant = getQdrantClient();

  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
    await qdrant.delete(ragConfig.qdrantCollection, {
      wait: true,
      points: chunk,
    });
  }
}

export async function deletePointsByNoteId(noteId: string): Promise<void> {
  const qdrant = getQdrantClient();
  await qdrant.delete(ragConfig.qdrantCollection, {
    wait: true,
    filter: {
      must: [{ key: "noteId", match: { value: noteId } }],
    },
  });
}

/** Update social stats on existing points without re-embedding. */
export async function patchNotePayloadStats(
  noteId: string,
  stats: {
    avgRating: number;
    voteCount: number;
    commentCount: number;
    authorId?: string | null;
    authorName?: string | null;
  },
): Promise<void> {
  const qdrant = getQdrantClient();
  await qdrant.setPayload(ragConfig.qdrantCollection, {
    wait: true,
    payload: {
      avgRating: stats.avgRating,
      voteCount: stats.voteCount,
      commentCount: stats.commentCount,
      ...(stats.authorId !== undefined ? { authorId: stats.authorId } : {}),
      ...(stats.authorName !== undefined
        ? { authorName: stats.authorName }
        : {}),
    },
    filter: {
      must: [{ key: "noteId", match: { value: noteId } }],
    },
  });
}

export async function searchSimilar(
  vector: number[],
  options?: { limit?: number; type?: CatalogType },
): Promise<SearchHit[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.search(ragConfig.qdrantCollection, {
    vector,
    limit: options?.limit ?? ragConfig.topK,
    with_payload: true,
    filter: options?.type
      ? {
          must: [{ key: "type", match: { value: options.type } }],
        }
      : undefined,
  });

  return result.map((point) => {
    const payload = (point.payload || {}) as Record<string, unknown>;
    return {
      score: point.score,
      type: (payload.type as CatalogType) || "note",
      payload,
    };
  });
}

export async function scrollByType(
  type: CatalogType,
  limit = 40,
): Promise<SearchHit[]> {
  const qdrant = getQdrantClient();
  const hits: SearchHit[] = [];
  let offset: string | number | Record<string, unknown> | undefined;
  const pageSize = Math.min(limit, SCROLL_PAGE_SIZE);

  while (hits.length < limit) {
    const result = await qdrant.scroll(ragConfig.qdrantCollection, {
      limit: Math.min(pageSize, limit - hits.length),
      with_payload: true,
      with_vector: false,
      offset,
      filter: {
        must: [{ key: "type", match: { value: type } }],
      },
    });

    for (const point of result.points) {
      const payload = (point.payload || {}) as Record<string, unknown>;
      hits.push({
        score: 1,
        type: (payload.type as CatalogType) || type,
        payload,
      });
      if (hits.length >= limit) break;
    }

    if (result.next_page_offset == null || result.points.length === 0) break;
    offset = result.next_page_offset as typeof offset;
  }

  return hits;
}

export async function findHitsByNoteId(noteId: string): Promise<SearchHit[]> {
  const qdrant = getQdrantClient();
  const hits: SearchHit[] = [];
  let offset: string | number | Record<string, unknown> | undefined;

  for (;;) {
    const result = await qdrant.scroll(ragConfig.qdrantCollection, {
      limit: SCROLL_PAGE_SIZE,
      with_payload: true,
      with_vector: false,
      offset,
      filter: {
        must: [{ key: "noteId", match: { value: noteId } }],
      },
    });

    for (const point of result.points) {
      const payload = (point.payload || {}) as Record<string, unknown>;
      hits.push({
        score: 1,
        type: "note",
        payload,
      });
    }

    if (result.next_page_offset == null) break;
    offset = result.next_page_offset as typeof offset;
  }

  return hits;
}

export type QdrantPingResult = { ok: boolean; error?: string };

export async function pingQdrant(): Promise<QdrantPingResult> {
  try {
    await getQdrantClient().getCollections();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
