# Cinco Wiki

Application web collaborative de prise de notes — espace commun, notes en rich-text,
votes (étoiles), commentaires, tags, recherche full-text, assistant **GraphRAG** sur `/ask`.
Cf. `Cinco_Wiki_Spec_Fonctionnelle.md`.

## Architecture

Monorepo npm workspaces, deux déployables :

```
Netlify                         AWS eu-west-3 (Serverless Framework)
┌─────────────┐   REST/JWT      ┌──────────────────────────────────┐
│  Next.js    │ ───────────────►│  API Gateway → Lambda (Hono)      │
│ (frontend)  │                 │     ├── MongoDB Atlas              │
└─────────────┘                 │     ├── S3 (images)                │
                                │     ├── Qdrant (vecteurs, opt.)    │
                                │     └── Neo4j (graphe, opt.)       │
                                └──────────────────────────────────┘
```

| Package | Rôle |
|---|---|
| `packages/shared` | Contrat d'API : types + règles (`LIMITS`, helpers). Source de vérité. |
| `packages/backend` | App Hono unique sur Lambda (router interne), MongoDB, S3, OG, GraphRAG. |
| `packages/frontend` | Next.js App Router + Tailwind + TipTap + SWR. |

- `serverless.yml` — infra backend (API Gateway HTTP API, Lambda, S3, IAM).
- `docker-compose.rag.yml` — Qdrant + Neo4j **locaux** (dev, assistant `/ask`).
- `docker-compose.rag.prod.yml` — même stack **prod VPS** (bind 127.0.0.1, API key, limits).
- `.env.rag.prod.example` — secrets / tuning pour le compose prod.
- `docs/CONTRACT_API.md` — règles métier par endpoint.
- `docs/CONTRACT_FRONTEND.md` — props des composants + routing.

## Prérequis

- Node 20+
- Un cluster **MongoDB Atlas** (URI), idéalement avec un index Atlas Search.
- Compte AWS configuré (`aws configure`) pour le déploiement.
- Serverless Framework v3 (installé en devDependency ; pas de compte requis).
- **Docker** (optionnel) — Qdrant + Neo4j pour l'assistant GraphRAG (`npm run qdrant:up`).

## Installation

```bash
npm install
```

## Backend (Serverless Framework)

Les secrets vivent dans **SSM Parameter Store** (clés `/cinco-wiki/<stage>/<NOM>`).
Renseigner un `.env` à la racine (cf. `.env.example`) puis pousser une fois par stage :

```bash
cp .env.example .env             # renseigner MONGODB_URI, JWT_SECRET, CORS_ORIGINS...
npm run secrets:set              # stage dev (défaut) — pousse .env vers SSM
npm run secrets:set -- production   # autre stage : args après --
```

Détail des paramètres SSM créés :

| Variable Lambda | Paramètre SSM | Type |
|---|---|---|
| `MONGODB_URI` | `/cinco-wiki/<stage>/MONGODB_URI` | SecureString |
| `JWT_SECRET` | `/cinco-wiki/<stage>/JWT_SECRET` | SecureString |
| `MONGODB_DB` | `/cinco-wiki/<stage>/MONGODB_DB` | String (défaut `cinco-wiki`) |
| `CORS_ORIGINS` | `/cinco-wiki/<stage>/CORS_ORIGINS` | String (défaut `*`) |
| `QDRANT_URL` | `/cinco-wiki/<stage>/QDRANT_URL` | String (optionnel — RAG) |
| `QDRANT_API_KEY` | `/cinco-wiki/<stage>/QDRANT_API_KEY` | SecureString (optionnel) |
| `QDRANT_COLLECTION` | `/cinco-wiki/<stage>/QDRANT_COLLECTION` | String (défaut `cinco_wiki`) |
| `OPENAI_API_KEY` | `/cinco-wiki/<stage>/OPENAI_API_KEY` | SecureString (résumé liens + RAG) |

Variables GraphRAG locales (`.env`, non poussées par défaut via SSM sauf si vous les ajoutez) :

| Variable | Rôle |
|---|---|
| `NEO4J_URI` | Bolt URI (ex. `bolt://localhost:7687`) |
| `NEO4J_USER` / `NEO4J_PASSWORD` | Auth Neo4j |
| `LLM_PROVIDER` | `openai` \| `openrouter` |
| `EMBEDDING_MODEL` / `CHAT_MODEL` | Modèles embeddings / chat |

`BUCKET_NAME` est dérivé automatiquement (`cinco-wiki-uploads-<stage>`) ;
surchargeable via `--param="bucketName=..."`.

### Région & profil AWS

Région via `AWS_REGION` (défaut `eu-west-3`), profil via `AWS_PROFILE`. Valables pour
`set-secrets.sh` **et** `serverless deploy`. ⚠️ Les secrets SSM sont **par région** :
pousser et déployer dans la **même** région.

```bash
# au choix : exporter dans le shell (vaut pour les deux commandes)
export AWS_PROFILE=cinco AWS_REGION=eu-west-3
npm run secrets:set
npm run deploy:dev

# ou en flags (uniquement le déploiement)
npm run deploy:dev -- --aws-profile cinco --region eu-west-3
```

`set-secrets.sh` lit aussi `AWS_REGION` / `AWS_PROFILE` depuis le `.env` (un export
shell est prioritaire).

Dev local (émulation API Gateway + Lambda) :

```bash
npm run dev          # serverless offline — sert l'API sur http://localhost:3000
```

Déploiement :

```bash
npm run deploy:dev   # serverless deploy --stage dev
npm run deploy       # serverless deploy --stage production
```

La sortie de `serverless deploy` affiche l'URL de l'API (à reporter dans
`NEXT_PUBLIC_API_URL` du frontend).

## Frontend (Next.js)

```bash
cd packages/frontend
cp .env.local.example .env.local   # renseigner NEXT_PUBLIC_API_URL (URL de l'API déployée)
npm run frontend                   # depuis la racine — ou npm run dev dans packages/frontend
```

Déploiement Netlify : base `packages/frontend`, plugin `@netlify/plugin-nextjs`
(cf. `packages/frontend/netlify.toml`). Définir `NEXT_PUBLIC_API_URL` dans l'env Netlify.

## Assistant GraphRAG (optionnel)

Chat sur les notes publiées via `/ask` (`POST /rag/chat`). Code dans
`packages/backend/src/rag`.

| Store | Rôle |
|-------|------|
| **Qdrant** | Recherche sémantique (chunks de notes publiées) |
| **Neo4j** | Graphe social : auteurs, tags, liens, votes, commentaires |

Sans `QDRANT_URL` / clé LLM, l'assistant est désactivé — le reste du wiki fonctionne.
Sans Neo4j (`NEO4J_*`), le chat vectoriel reste disponible ; les tools graphe sont no-op.

### Démarrage local

```bash
npm run qdrant:up
# .env : QDRANT_URL, OPENAI_API_KEY, NEO4J_URI/USER/PASSWORD (+ MONGODB_URI, JWT_SECRET…)
npm run rag:sync          # MongoDB → Qdrant + Neo4j
npm run dev               # API backend
npm run frontend          # UI /ask
```

Ports locaux (compose) :

| Service | URL |
|---------|-----|
| Qdrant HTTP | http://localhost:6333 |
| Neo4j Browser | http://localhost:7474 |
| Neo4j Bolt | `bolt://localhost:7687` |

> En local, ne laissez **pas** `QDRANT_API_KEY` défini avec une valeur vide si le
> conteneur active l'auth : laissez la variable absente, ou alignez la clé côté client
> et serveur.

### Sync

- **Full** : `npm run rag:sync` (notes publiées → embeddings Qdrant + graphe Neo4j).
- **Incrémental notes** : create/update/unpublish → index Qdrant + structure graphe.
- **Incrémental social** : votes / commentaires / réactions → arêtes Neo4j + stats payload Qdrant (sans re-embed).

| Script | Action |
|--------|--------|
| `npm run qdrant:up` | Démarre Qdrant + Neo4j (Docker **dev**) |
| `npm run qdrant:down` | Arrête la stack RAG dev |
| `npm run rag:prod:up` | Démarre la stack **prod** (`docker-compose.rag.prod.yml` + `.env.rag.prod`) |
| `npm run rag:prod:down` | Arrête la stack prod |
| `npm run rag:sync` | Reindex complet (CLI, sans JWT) |
| `npm run rag:sync -- --note-id <id>` | Sync d'une note publiée |
| `npm run rag:sync -- --delete-note <id>` | Purge Qdrant (+ graphe) d'une note |

### Déploiement VPS (modèle prod)

Même services que le compose dev ; seuls 3 secrets dans `.env.rag.prod` :

```bash
cp .env.rag.prod.example .env.rag.prod
# QDRANT_API_KEY / NEO4J_USER / NEO4J_PASSWORD
npm run rag:prod:up
```

Ports bindés sur `127.0.0.1` uniquement. TLS (Nginx/Caddy) → Qdrant `:6333` si besoin.
Fichier : [`docker-compose.rag.prod.yml`](docker-compose.rag.prod.yml).

### Outils agent & MCP

L'agent (`POST /rag/chat`) et le serveur MCP HTTP (auth JWT, préfixe `/rag`) partagent
les mêmes tools (`packages/backend/src/rag/catalog/tools.ts`) :

| Intention | Tool |
|-----------|------|
| Contenu / sens | `searchNotes`, `getNote` |
| Tags / exploration | `listTags`, `listRecentNotes` |
| Liens / tags partagés | `relatedNotes`, `notesBySharedTags`, `graphPath` |
| Classements | `topRatedNotes`, `mostCommentedNotes` |
| Auteurs | `notesByAuthor`, `authorsByTag` |
| Votes | `noteRatings`, `notesRatedByUser` |
| Commentaires | `noteComments`, `notesCommentedByUser` |

Endpoints MCP :

```
GET  /rag/mcp
GET  /rag/mcp/tools
POST /rag/mcp/tools/:name
POST /rag/mcp                 # JSON-RPC : initialize | tools/list | tools/call
```

Health : `GET /rag/health` → `{ qdrant, neo4j, graphConfigured }`.

## Amorçage du premier admin

Aucune inscription publique (§3.1). Le script `scripts/seed-admin.mjs` crée (ou
promeut) le premier administrateur directement en base — `role:"admin"`,
`status:"active"`, `tokenVersion:0`, `passwordHash` bcrypt (coût 10, identique au
backend). Idempotent (clé unique sur `email`).

```bash
# MONGODB_URI requis ; MONGODB_DB défaut "cinco-wiki" ; email défaut jonathan@cinco.ai
MONGODB_URI="mongodb+srv://user:pass@cluster/..." npm run seed:admin
```

Variables : `SEED_ADMIN_EMAIL`, `SEED_ADMIN_FIRSTNAME`, `SEED_ADMIN_LASTNAME`,
`SEED_ADMIN_PASSWORD` (sinon un mot de passe fort est généré et affiché une fois).
Drapeaux : `--email --first --last --password --reset-password`. Un `.env` à la
racine est chargé s'il existe. Puis se connecter et gérer les comptes via
`/admin/utilisateurs`.

## Qualité

```bash
npm run typecheck    # vérifie shared + backend + frontend
```

## Écarts assumés vs spec

- **Preview de liens** : route `GET /og` dans la même Lambda Hono (la spec suggérait
  une Lambda dédiée) — même résultat, moins d'infra.
- **Modal partageable** : implémentée via `/[id]` rendant le dashboard avec la modal
  ouverte (au lieu des intercepting routes), pour un accès direct et un partage simples.
