import { isGraphConfigured } from "../config.js";
import { getNeo4jDriver } from "./neo4j.js";

export type GraphNote = {
  noteId: string;
  title: string;
  urlPath: string;
  avgRating?: number;
  voteCount?: number;
  commentCount?: number;
};

export type GraphUserRef = {
  id: string;
  name: string;
};

function toNote(props: Record<string, unknown>): GraphNote {
  const noteId = String(props.id || "");
  return {
    noteId,
    title: String(props.title || noteId),
    urlPath: String(props.urlPath || `/${noteId}`),
    avgRating:
      props.avgRating != null ? Number(props.avgRating) : undefined,
    voteCount:
      props.voteCount != null ? Number(props.voteCount) : undefined,
    commentCount:
      props.commentCount != null ? Number(props.commentCount) : undefined,
  };
}

function userName(props: Record<string, unknown>): string {
  return `${props.firstName || ""} ${props.lastName || ""}`.trim() || String(props.id || "");
}

function nodeProps(node: { properties?: Record<string, unknown> } | null) {
  return node?.properties ?? {};
}

export async function relatedNotes(
  noteIdOrTitle: string,
  depth = 1,
): Promise<{
  found: boolean;
  seed: GraphNote | null;
  notes: GraphNote[];
  edges: string[];
}> {
  if (!isGraphConfigured()) {
    return { found: false, seed: null, notes: [], edges: [] };
  }

  const driver = getNeo4jDriver();
  const session = driver.session();
  const safeDepth = Math.min(Math.max(depth, 1), 2);

  try {
    const seedResult = await session.run(
      `
      MATCH (n:Note)
      WHERE n.id = $needle OR toLower(n.title) = toLower($needle)
      RETURN n
      LIMIT 1
      `,
      { needle: noteIdOrTitle.trim() },
    );
    const seedNode = seedResult.records[0]?.get("n") as {
      properties: Record<string, unknown>;
    } | null;
    if (!seedNode) {
      return { found: false, seed: null, notes: [], edges: [] };
    }
    const seed = toNote(nodeProps(seedNode));

    const result = await session.run(
      `
      MATCH (n:Note {id: $id})
      OPTIONAL MATCH (n)-[*1..${safeDepth}]-(related:Note)
      WHERE related.id <> n.id
      WITH n, collect(DISTINCT related) AS relatedNotes
      RETURN relatedNotes
      `,
      { id: seed.noteId },
    );

    const related = (
      (result.records[0]?.get("relatedNotes") || []) as Array<{
        properties: Record<string, unknown>;
      }>
    )
      .filter(Boolean)
      .map((n) => toNote(nodeProps(n)));

    const edgeResult = await session.run(
      `
      MATCH (n:Note {id: $id})-[r]-(m)
      RETURN n.title AS fromTitle,
             type(r) AS relType,
             coalesce(m.title, m.name, m.id) AS toLabel
      LIMIT 40
      `,
      { id: seed.noteId },
    );

    const edges = edgeResult.records.map(
      (r) => `${r.get("fromTitle")} ${r.get("relType")} ${r.get("toLabel")}`,
    );

    return { found: true, seed, notes: related, edges };
  } finally {
    await session.close();
  }
}

export async function notesBySharedTags(args: {
  noteIdOrTitle: string;
  limit?: number;
}): Promise<{
  found: boolean;
  seed: GraphNote | null;
  notes: Array<GraphNote & { sharedTags: string[] }>;
}> {
  if (!isGraphConfigured()) {
    return { found: false, seed: null, notes: [] };
  }

  const driver = getNeo4jDriver();
  const session = driver.session();
  const limit = args.limit ?? 10;

  try {
    const seedResult = await session.run(
      `
      MATCH (n:Note)
      WHERE n.id = $needle OR toLower(n.title) = toLower($needle)
      RETURN n
      LIMIT 1
      `,
      { needle: args.noteIdOrTitle.trim() },
    );
    const seedNode = seedResult.records[0]?.get("n") as {
      properties: Record<string, unknown>;
    } | null;
    if (!seedNode) {
      return { found: false, seed: null, notes: [] };
    }
    const seed = toNote(nodeProps(seedNode));

    const result = await session.run(
      `
      MATCH (n:Note {id: $id})-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(other:Note)
      WHERE other.id <> n.id
      WITH other, collect(DISTINCT t.name) AS sharedTags
      RETURN other, sharedTags
      ORDER BY size(sharedTags) DESC
      LIMIT $limit
      `,
      { id: seed.noteId, limit: neo4jInt(limit) },
    );

    const notes = result.records.map((r) => {
      const other = toNote(
        nodeProps(
          r.get("other") as { properties: Record<string, unknown> },
        ),
      );
      const sharedTags = (r.get("sharedTags") as string[]) || [];
      return { ...other, sharedTags };
    });

    return { found: true, seed, notes };
  } finally {
    await session.close();
  }
}

export async function graphPathBetweenNotes(args: {
  from: string;
  to: string;
}): Promise<{
  found: boolean;
  path: string[];
  notes: GraphNote[];
}> {
  if (!isGraphConfigured()) {
    return { found: false, path: [], notes: [] };
  }

  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (a:Note)
      WHERE a.id = $from OR toLower(a.title) = toLower($from)
      WITH a LIMIT 1
      MATCH (b:Note)
      WHERE b.id = $to OR toLower(b.title) = toLower($to)
      WITH a, b LIMIT 1
      MATCH path = shortestPath((a)-[*..6]-(b))
      RETURN nodes(path) AS nodes, relationships(path) AS rels
      `,
      { from: args.from.trim(), to: args.to.trim() },
    );

    const record = result.records[0];
    if (!record) {
      return { found: false, path: [], notes: [] };
    }

    const rawNodes = record.get("nodes") as Array<{
      properties: Record<string, unknown>;
      labels: string[];
    }>;
    const rels = record.get("rels") as Array<{ type: string }>;

    const notes: GraphNote[] = [];
    const path: string[] = [];

    for (let i = 0; i < rawNodes.length; i += 1) {
      const n = rawNodes[i];
      if (!n) continue;
      const props = nodeProps(n);
      if ((n.labels || []).includes("Note")) {
        const note = toNote(props);
        notes.push(note);
        path.push(note.title);
      } else {
        path.push(String(props.name || props.id || "?"));
      }
      const rel = rels[i];
      if (rel) {
        path.push(rel.type);
      }
    }

    return { found: true, path, notes };
  } finally {
    await session.close();
  }
}

function neo4jInt(n: number) {
  // neo4j-driver accepts plain numbers for LIMIT in recent versions
  return Math.max(1, Math.floor(n));
}

export function formatGraphContext(args: {
  notes: GraphNote[];
  edges: string[];
}): string {
  if (args.notes.length === 0 && args.edges.length === 0) return "";
  const titles = args.notes.map((n) => n.title).join(", ");
  const edges = args.edges.join("; ");
  return `Graph context — related notes: ${titles}. Edges: ${edges}`;
}

type NeoSession = {
  run: (
    query: string,
    params?: Record<string, unknown>,
  ) => Promise<{ records: Array<{ get: (key: string) => unknown }> }>;
};

async function resolveUser(
  session: NeoSession,
  nameOrId: string,
): Promise<GraphUserRef | null> {
  const result = await session.run(
    `
    MATCH (u:User)
    WHERE u.id = $needle
       OR toLower(u.firstName + ' ' + u.lastName) = toLower($needle)
       OR toLower(u.firstName) = toLower($needle)
       OR toLower(u.lastName) = toLower($needle)
    RETURN u
    LIMIT 1
    `,
    { needle: nameOrId.trim() },
  );
  const node = result.records[0]?.get("u") as {
    properties: Record<string, unknown>;
  } | null;
  if (!node) return null;
  const props = nodeProps(node);
  return { id: String(props.id || ""), name: userName(props) };
}

async function resolveNoteId(
  session: NeoSession,
  noteIdOrTitle: string,
): Promise<GraphNote | null> {
  const result = await session.run(
    `
    MATCH (n:Note)
    WHERE n.id = $needle OR toLower(n.title) = toLower($needle)
    RETURN n
    LIMIT 1
    `,
    { needle: noteIdOrTitle.trim() },
  );
  const node = result.records[0]?.get("n") as {
    properties: Record<string, unknown>;
  } | null;
  return node ? toNote(nodeProps(node)) : null;
}

export async function topRatedNotes(args: {
  limit?: number;
  tag?: string;
}): Promise<{ notes: GraphNote[] }> {
  if (!isGraphConfigured()) return { notes: [] };
  const driver = getNeo4jDriver();
  const session = driver.session();
  const limit = neo4jInt(args.limit ?? 10);
  try {
    const result = args.tag
      ? await session.run(
          `
          MATCH (n:Note)-[:HAS_TAG]->(t:Tag {name: $tag})
          WHERE n.voteCount > 0
          RETURN n
          ORDER BY n.avgRating DESC, n.voteCount DESC
          LIMIT $limit
          `,
          { tag: args.tag.trim().toLowerCase(), limit },
        )
      : await session.run(
          `
          MATCH (n:Note)
          WHERE n.voteCount > 0
          RETURN n
          ORDER BY n.avgRating DESC, n.voteCount DESC
          LIMIT $limit
          `,
          { limit },
        );
    return {
      notes: result.records.map((r) =>
        toNote(nodeProps(r.get("n") as { properties: Record<string, unknown> })),
      ),
    };
  } finally {
    await session.close();
  }
}

export async function mostCommentedNotes(args: {
  limit?: number;
}): Promise<{ notes: GraphNote[] }> {
  if (!isGraphConfigured()) return { notes: [] };
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (n:Note)
      WHERE n.commentCount > 0
      RETURN n
      ORDER BY n.commentCount DESC
      LIMIT $limit
      `,
      { limit: neo4jInt(args.limit ?? 10) },
    );
    return {
      notes: result.records.map((r) =>
        toNote(nodeProps(r.get("n") as { properties: Record<string, unknown> })),
      ),
    };
  } finally {
    await session.close();
  }
}

export async function notesByAuthor(args: {
  nameOrId: string;
}): Promise<{ found: boolean; author: GraphUserRef | null; notes: GraphNote[] }> {
  if (!isGraphConfigured()) {
    return { found: false, author: null, notes: [] };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const author = await resolveUser(session, args.nameOrId);
    if (!author) return { found: false, author: null, notes: [] };
    const result = await session.run(
      `
      MATCH (u:User {id: $id})-[:AUTHORED]->(n:Note)
      RETURN n
      ORDER BY n.title
      `,
      { id: author.id },
    );
    return {
      found: true,
      author,
      notes: result.records.map((r) =>
        toNote(nodeProps(r.get("n") as { properties: Record<string, unknown> })),
      ),
    };
  } finally {
    await session.close();
  }
}

export async function noteRatings(args: {
  noteIdOrTitle: string;
}): Promise<{
  found: boolean;
  note: GraphNote | null;
  avgRating: number;
  voteCount: number;
  ratings: Array<{ user: string; value: number }>;
}> {
  if (!isGraphConfigured()) {
    return {
      found: false,
      note: null,
      avgRating: 0,
      voteCount: 0,
      ratings: [],
    };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const note = await resolveNoteId(session, args.noteIdOrTitle);
    if (!note) {
      return {
        found: false,
        note: null,
        avgRating: 0,
        voteCount: 0,
        ratings: [],
      };
    }
    const result = await session.run(
      `
      MATCH (u:User)-[r:RATED]->(n:Note {id: $id})
      RETURN u, r.value AS value
      ORDER BY r.value DESC
      `,
      { id: note.noteId },
    );
    const ratings = result.records.map((r) => ({
      user: userName(
        nodeProps(r.get("u") as { properties: Record<string, unknown> }),
      ),
      value: Number(r.get("value")),
    }));
    return {
      found: true,
      note,
      avgRating: note.avgRating ?? 0,
      voteCount: note.voteCount ?? ratings.length,
      ratings,
    };
  } finally {
    await session.close();
  }
}

export async function notesRatedByUser(args: {
  nameOrId: string;
  minValue?: number;
}): Promise<{
  found: boolean;
  user: GraphUserRef | null;
  notes: Array<GraphNote & { value: number }>;
}> {
  if (!isGraphConfigured()) {
    return { found: false, user: null, notes: [] };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const user = await resolveUser(session, args.nameOrId);
    if (!user) return { found: false, user: null, notes: [] };
    const minValue = args.minValue ?? 1;
    const result = await session.run(
      `
      MATCH (u:User {id: $id})-[r:RATED]->(n:Note)
      WHERE r.value >= $minValue
      RETURN n, r.value AS value
      ORDER BY r.value DESC
      `,
      { id: user.id, minValue },
    );
    return {
      found: true,
      user,
      notes: result.records.map((r) => ({
        ...toNote(
          nodeProps(r.get("n") as { properties: Record<string, unknown> }),
        ),
        value: Number(r.get("value")),
      })),
    };
  } finally {
    await session.close();
  }
}

export async function noteComments(args: {
  noteIdOrTitle: string;
  limit?: number;
}): Promise<{
  found: boolean;
  note: GraphNote | null;
  comments: Array<{
    author: string;
    textPreview: string;
    createdAt: string | null;
  }>;
}> {
  if (!isGraphConfigured()) {
    return { found: false, note: null, comments: [] };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const note = await resolveNoteId(session, args.noteIdOrTitle);
    if (!note) return { found: false, note: null, comments: [] };
    const result = await session.run(
      `
      MATCH (c:Comment)-[:ON_NOTE]->(n:Note {id: $id})
      OPTIONAL MATCH (u:User)-[:WROTE]->(c)
      RETURN c, u
      ORDER BY c.createdAt
      LIMIT $limit
      `,
      { id: note.noteId, limit: neo4jInt(args.limit ?? 20) },
    );
    return {
      found: true,
      note,
      comments: result.records.map((r) => {
        const c = nodeProps(
          r.get("c") as { properties: Record<string, unknown> },
        );
        const u = r.get("u") as { properties: Record<string, unknown> } | null;
        return {
          author: u ? userName(nodeProps(u)) : "Utilisateur supprimé",
          textPreview: String(c.textPreview || ""),
          createdAt: c.createdAt != null ? String(c.createdAt) : null,
        };
      }),
    };
  } finally {
    await session.close();
  }
}

export async function notesCommentedByUser(args: {
  nameOrId: string;
}): Promise<{
  found: boolean;
  user: GraphUserRef | null;
  notes: GraphNote[];
}> {
  if (!isGraphConfigured()) {
    return { found: false, user: null, notes: [] };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    const user = await resolveUser(session, args.nameOrId);
    if (!user) return { found: false, user: null, notes: [] };
    const result = await session.run(
      `
      MATCH (u:User {id: $id})-[:WROTE]->(:Comment)-[:ON_NOTE]->(n:Note)
      RETURN DISTINCT n
      ORDER BY n.title
      `,
      { id: user.id },
    );
    return {
      found: true,
      user,
      notes: result.records.map((r) =>
        toNote(nodeProps(r.get("n") as { properties: Record<string, unknown> })),
      ),
    };
  } finally {
    await session.close();
  }
}

export async function authorsByTag(args: {
  tag: string;
}): Promise<{ tag: string; authors: Array<GraphUserRef & { noteCount: number }> }> {
  if (!isGraphConfigured()) {
    return { tag: args.tag, authors: [] };
  }
  const driver = getNeo4jDriver();
  const session = driver.session();
  const tag = args.tag.trim().toLowerCase();
  try {
    const result = await session.run(
      `
      MATCH (u:User)-[:AUTHORED]->(n:Note)-[:HAS_TAG]->(t:Tag)
      WHERE t.name = $tag OR toLower(t.name) = $tag
      WITH u, count(DISTINCT n) AS noteCount
      RETURN u, noteCount
      ORDER BY noteCount DESC
      `,
      { tag },
    );
    return {
      tag,
      authors: result.records.map((r) => {
        const props = nodeProps(
          r.get("u") as { properties: Record<string, unknown> },
        );
        return {
          id: String(props.id || ""),
          name: userName(props),
          noteCount: Number(r.get("noteCount")),
        };
      }),
    };
  } finally {
    await session.close();
  }
}
