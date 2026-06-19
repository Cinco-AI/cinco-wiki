#!/usr/bin/env node
/**
 * Amorçage du premier administrateur Cinco Wiki directement en base MongoDB.
 *
 * Aucune inscription publique (§3.1) : ce script crée (ou promeut) un compte
 * `role:"admin"`, `status:"active"`, avec un `passwordHash` bcrypt identique à
 * celui produit par le backend (`bcrypt`, coût 10 — cf. packages/backend/src/lib/auth.ts).
 * Idempotent : relançable sans dupliquer le compte (clé unique sur `email`).
 *
 * Variables d'environnement :
 *   MONGODB_URI            (requis) URI MongoDB Atlas — ex. mongodb+srv://user:pass@cluster/...
 *   MONGODB_DB             (def. "cinco-wiki") nom de la base.
 *   SEED_ADMIN_EMAIL       (def. "jonathan@cinco.ai")
 *   SEED_ADMIN_FIRSTNAME   (def. "Jonathan")
 *   SEED_ADMIN_LASTNAME    (def. "Cinco")
 *   SEED_ADMIN_PASSWORD    (optionnel) sinon un mot de passe fort est généré et affiché.
 *
 * Drapeaux CLI (priment sur l'env) :
 *   --email <e>  --first <f>  --last <l>  --password <p>  --reset-password
 *
 * Si le compte existe déjà : son rôle est forcé à "admin" et son statut à "active".
 * Le mot de passe n'est réécrit que si `--reset-password` (ou SEED_ADMIN_PASSWORD/--password)
 * est fourni — dans ce cas `tokenVersion` est incrémenté pour couper les sessions actives.
 *
 * Usage :
 *   MONGODB_URI="mongodb+srv://..." node scripts/seed-admin.mjs
 *   npm run seed:admin
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- Chargement optionnel d'un .env à la racine (ne remplace pas l'existant) ---
function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* pas de .env : on s'appuie sur l'environnement réel */
  }
}

// --- Parsing minimal des drapeaux CLI ---
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reset-password") out.resetPassword = true;
    else if (a === "--email") out.email = argv[++i];
    else if (a === "--first") out.first = argv[++i];
    else if (a === "--last") out.last = argv[++i];
    else if (a === "--password") out.password = argv[++i];
  }
  return out;
}

/** Mot de passe fort, sans caractères ambigus. */
function generatePassword(len = 18) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "✗ MONGODB_URI manquant. Fournis-le via l'environnement ou un .env à la racine.\n" +
        '  ex. MONGODB_URI="mongodb+srv://user:pass@cluster/..." npm run seed:admin',
    );
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB ?? "cinco-wiki";

  const email = (args.email ?? process.env.SEED_ADMIN_EMAIL ?? "jonathan@cinco.ai")
    .trim()
    .toLowerCase();
  const firstName = args.first ?? process.env.SEED_ADMIN_FIRSTNAME ?? "Jonathan";
  const lastName = args.last ?? process.env.SEED_ADMIN_LASTNAME ?? "Cinco";

  const explicitPassword = args.password ?? process.env.SEED_ADMIN_PASSWORD;
  const password = explicitPassword ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const client = new MongoClient(uri, { maxPoolSize: 5, retryWrites: true });
  await client.connect();
  try {
    const db = client.db(dbName);
    const users = db.collection("users");

    // Aligne l'index unique avec celui géré par le backend (ensureIndexes).
    await users.createIndex({ email: 1 }, { unique: true });

    const now = new Date();
    const existing = await users.findOne({ email });

    if (!existing) {
      await users.insertOne({
        _id: new ObjectId(),
        firstName,
        lastName,
        email,
        passwordHash,
        role: "admin",
        status: "active",
        avatarUrl: null,
        tokenVersion: 0,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`✓ Admin créé : ${email}`);
      console.log(`  Mot de passe : ${password}`);
      if (!explicitPassword) {
        console.log("  ⚠ Généré aléatoirement — note-le, il ne sera plus affiché.");
      }
    } else {
      const resetPassword = Boolean(args.resetPassword || explicitPassword);
      const set = { role: "admin", status: "active", updatedAt: now };
      const update = { $set: set };
      if (resetPassword) {
        set.passwordHash = passwordHash;
        update.$inc = { tokenVersion: 1 }; // invalide les sessions existantes
      }
      await users.updateOne({ _id: existing._id }, update);
      console.log(`✓ Compte existant promu admin/actif : ${email}`);
      if (resetPassword) {
        console.log(`  Nouveau mot de passe : ${password}`);
        if (!explicitPassword) {
          console.log("  ⚠ Généré aléatoirement — note-le, il ne sera plus affiché.");
        }
      } else {
        console.log("  Mot de passe inchangé (passe --reset-password pour le réinitialiser).");
      }
    }

    console.log(`  Base : ${dbName} · collection users`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("✗ Échec du seed admin :", err?.message ?? err);
  process.exit(1);
});
