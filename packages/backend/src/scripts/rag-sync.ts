#!/usr/bin/env node
/**
 * Synchronise les notes MongoDB publiées vers Qdrant (embeddings RAG).
 *
 * Variables d'environnement (cf. .env racine) :
 *   MONGODB_URI, MONGODB_DB
 *   QDRANT_URL, QDRANT_API_KEY (optionnel), QDRANT_COLLECTION
 *   OPENAI_API_KEY ou OPENROUTER_API_KEY + LLM_PROVIDER
 *
 * Usage :
 *   npm run rag:sync                              # full sync
 *   npm run rag:sync -- --note-id <id>            # une note
 *   npm run rag:sync -- --delete-note <id>        # purge index d'une note
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { isRagConfigured, ragConfig } from "../rag/config.js";
import {
  deleteNoteIndex,
  runFullSync,
  upsertNoteIndex,
} from "../rag/sync/indexer.js";
import { pingQdrant } from "../rag/vector/qdrant.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m?.[1]) continue;
      const key = m[1];
      let val = (m[2] ?? "").trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* pas de .env */
  }
}

function parseArgs(argv: string[]) {
  const out: { noteId?: string; deleteNote?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--note-id") out.noteId = argv[++i];
    else if (arg === "--delete-note") out.deleteNote = argv[++i];
  }
  return out;
}

async function main() {
  loadDotEnv();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI manquant (définir dans .env ou l'environnement).");
    process.exit(1);
  }

  if (!isRagConfigured()) {
    console.error(
      "RAG non configuré : QDRANT_URL et OPENAI_API_KEY (ou OPENROUTER) requis.",
    );
    process.exit(1);
  }

  const qdrantPing = await pingQdrant();
  if (!qdrantPing.ok) {
    const url = ragConfig.qdrantUrl || "(vide)";
    const hasKey = Boolean(ragConfig.qdrantApiKey);
    console.error(`Qdrant injoignable (${url}, apiKey=${hasKey ? "oui" : "non"}).`);
    if (qdrantPing.error) {
      console.error(`Détail: ${qdrantPing.error}`);
    }
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      console.error("Local: lancez `npm run qdrant:up` et vérifiez QDRANT_URL.");
    } else {
      console.error(
        "Distant: vérifiez QDRANT_URL (HTTPS), QDRANT_API_KEY, et l'accès réseau / reverse proxy.",
      );
    }
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB ?? "cinco-wiki";
  const args = parseArgs(process.argv.slice(2));
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    if (args.deleteNote) {
      const result = await deleteNoteIndex(db, args.deleteNote);
      console.log(JSON.stringify({ mode: "delete-note", noteId: args.deleteNote, ...result }, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    if (args.noteId) {
      const result = await upsertNoteIndex(db, args.noteId);
      console.log(JSON.stringify({ mode: "note", noteId: args.noteId, ...result }, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    const result = await runFullSync(db);
    console.log(JSON.stringify({ mode: "full", ...result }, null, 2));
    process.exit(result.ok ? 0 : 1);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[rag:sync] fatal: ${message}`);
  process.exit(1);
});
