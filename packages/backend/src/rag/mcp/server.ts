import { Hono } from "hono";
import type { Db } from "mongodb";
import { z } from "zod";
import {
  authorsByTag,
  getNote,
  graphPath,
  findNotes,
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
  topContributors,
  topRatedNotes,
} from "../catalog/tools.js";
import type { AppEnv } from "../../lib/http.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

function asText(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export const MCP_TOOLS = [
  {
    name: "searchNotes",
    description: "Semantic search over published Cinco Wiki notes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "getNote",
    description: "Get a note by Mongo id or approximate title",
    inputSchema: {
      type: "object",
      properties: {
        noteIdOrTitle: { type: "string" },
      },
      required: ["noteIdOrTitle"],
    },
  },
  {
    name: "listTags",
    description: "List wiki tags",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "findNotes",
    description:
      "List published notes with structured filters (sinceDays, linkHost e.g. youtube.com, sort, limit)",
    inputSchema: {
      type: "object",
      properties: {
        sinceDays: { type: "number" },
        linkHost: { type: "string" },
        sort: {
          type: "string",
          enum: ["createdAt", "avgRating", "commentCount"],
        },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "listRecentNotes",
    description: "Alias of findNotes({ sort: createdAt }) — prefer findNotes",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "relatedNotes",
    description:
      "Graph neighborhood (tags, author, internal links) for a note",
    inputSchema: {
      type: "object",
      properties: {
        noteIdOrTitle: { type: "string" },
        depth: { type: "number" },
      },
      required: ["noteIdOrTitle"],
    },
  },
  {
    name: "notesBySharedTags",
    description: "Notes sharing tags with a seed note (Neo4j)",
    inputSchema: {
      type: "object",
      properties: {
        noteIdOrTitle: { type: "string" },
        limit: { type: "number" },
      },
      required: ["noteIdOrTitle"],
    },
  },
  {
    name: "graphPath",
    description: "Shortest path between two notes in Neo4j",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "topContributors",
    description:
      "Rank authors by number of published notes (best contributor / top authors)",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "topRatedNotes",
    description: "Highest rated notes (avgRating)",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        tag: { type: "string" },
      },
    },
  },
  {
    name: "mostCommentedNotes",
    description: "Most commented notes",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "notesByAuthor",
    description: "Notes authored by a user (name or id)",
    inputSchema: {
      type: "object",
      properties: { nameOrId: { type: "string" } },
      required: ["nameOrId"],
    },
  },
  {
    name: "noteRatings",
    description: "Ratings/votes for a note",
    inputSchema: {
      type: "object",
      properties: { noteIdOrTitle: { type: "string" } },
      required: ["noteIdOrTitle"],
    },
  },
  {
    name: "notesRatedByUser",
    description: "Notes rated by a user",
    inputSchema: {
      type: "object",
      properties: {
        nameOrId: { type: "string" },
        minValue: { type: "number" },
      },
      required: ["nameOrId"],
    },
  },
  {
    name: "noteComments",
    description: "Comment previews on a note",
    inputSchema: {
      type: "object",
      properties: {
        noteIdOrTitle: { type: "string" },
        limit: { type: "number" },
      },
      required: ["noteIdOrTitle"],
    },
  },
  {
    name: "notesCommentedByUser",
    description: "Notes a user commented on",
    inputSchema: {
      type: "object",
      properties: { nameOrId: { type: "string" } },
      required: ["nameOrId"],
    },
  },
  {
    name: "authorsByTag",
    description: "Authors who published notes with a given tag",
    inputSchema: {
      type: "object",
      properties: { tag: { type: "string" } },
      required: ["tag"],
    },
  },
] as const;

async function callTool(
  db: Db,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "searchNotes": {
      const parsed = z
        .object({
          query: z.string(),
          limit: z.number().optional(),
        })
        .parse(args);
      return asText(await searchNotes(parsed));
    }
    case "getNote": {
      const parsed = z
        .object({ noteIdOrTitle: z.string() })
        .parse(args);
      return asText(await getNote(db, parsed));
    }
    case "listTags":
      return asText(await listTags(db));
    case "findNotes": {
      const parsed = z
        .object({
          sinceDays: z.number().optional(),
          linkHost: z.string().optional(),
          sort: z
            .enum(["createdAt", "avgRating", "commentCount"])
            .optional(),
          limit: z.number().optional(),
        })
        .parse(args);
      return asText(await findNotes(db, parsed));
    }
    case "listRecentNotes":
      return asText(await listRecentNotes(db));
    case "relatedNotes": {
      const parsed = z
        .object({
          noteIdOrTitle: z.string(),
          depth: z.number().optional(),
        })
        .parse(args);
      return asText(await relatedNotes(parsed));
    }
    case "notesBySharedTags": {
      const parsed = z
        .object({
          noteIdOrTitle: z.string(),
          limit: z.number().optional(),
        })
        .parse(args);
      return asText(await notesBySharedTags(parsed));
    }
    case "graphPath": {
      const parsed = z
        .object({
          from: z.string(),
          to: z.string(),
        })
        .parse(args);
      return asText(await graphPath(parsed));
    }
    case "topContributors": {
      const parsed = z.object({ limit: z.number().optional() }).parse(args);
      return asText(await topContributors(db, parsed));
    }
    case "topRatedNotes": {
      const parsed = z
        .object({
          limit: z.number().optional(),
          tag: z.string().optional(),
        })
        .parse(args);
      return asText(await topRatedNotes(parsed));
    }
    case "mostCommentedNotes": {
      const parsed = z
        .object({ limit: z.number().optional() })
        .parse(args);
      return asText(await mostCommentedNotes(parsed));
    }
    case "notesByAuthor": {
      const parsed = z.object({ nameOrId: z.string() }).parse(args);
      return asText(await notesByAuthor(parsed));
    }
    case "noteRatings": {
      const parsed = z.object({ noteIdOrTitle: z.string() }).parse(args);
      return asText(await noteRatings(parsed));
    }
    case "notesRatedByUser": {
      const parsed = z
        .object({
          nameOrId: z.string(),
          minValue: z.number().optional(),
        })
        .parse(args);
      return asText(await notesRatedByUser(parsed));
    }
    case "noteComments": {
      const parsed = z
        .object({
          noteIdOrTitle: z.string(),
          limit: z.number().optional(),
        })
        .parse(args);
      return asText(await noteComments(parsed));
    }
    case "notesCommentedByUser": {
      const parsed = z.object({ nameOrId: z.string() }).parse(args);
      return asText(await notesCommentedByUser(parsed));
    }
    case "authorsByTag": {
      const parsed = z.object({ tag: z.string() }).parse(args);
      return asText(await authorsByTag(parsed));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export const mcpRoutes = new Hono<AppEnv>();

mcpRoutes.get("/mcp", (c) =>
  c.json({
    name: "cinco-wiki",
    version: "1.0.0",
    tools: MCP_TOOLS,
  }),
);

mcpRoutes.get("/mcp/tools", (c) => c.json({ tools: MCP_TOOLS }));

mcpRoutes.post("/mcp/tools/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json().catch(() => ({}));

  try {
    if (!MCP_TOOLS.some((t) => t.name === name)) {
      return c.json({ error: "UNKNOWN_TOOL" }, 404);
    }
    return c.json(await callTool(c.get("db"), name, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

mcpRoutes.post("/mcp", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const method = body.method as string | undefined;
  const id = body.id ?? null;
  const db = c.get("db");

  if (method === "initialize") {
    return c.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "cinco-wiki", version: "1.0.0" },
      },
    });
  }

  if (method === "tools/list") {
    return c.json({
      jsonrpc: "2.0",
      id,
      result: { tools: MCP_TOOLS },
    });
  }

  if (method === "tools/call") {
    const toolName = body.params?.name as string;
    const args = (body.params?.arguments || {}) as Record<string, unknown>;
    try {
      if (!MCP_TOOLS.some((t) => t.name === toolName)) {
        return c.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
      }
      const result = await callTool(db, toolName, args);
      return c.json({ jsonrpc: "2.0", id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message },
      });
    }
  }

  return c.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});
