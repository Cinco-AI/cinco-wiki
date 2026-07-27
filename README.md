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
| `NEO4J_URI` | `/cinco-wiki/<stage>/NEO4J_URI` | String (optionnel — GraphRAG) |
| `NEO4J_USER` | `/cinco-wiki/<stage>/NEO4J_USER` | String (défaut `neo4j`) |
| `NEO4J_PASSWORD` | `/cinco-wiki/<stage>/NEO4J_PASSWORD` | SecureString (optionnel) |
| `OPENAI_API_KEY` | `/cinco-wiki/<stage>/OPENAI_API_KEY` | SecureString (résumé liens + RAG) |
| `OPENROUTER_API_KEY` | `/cinco-wiki/<stage>/OPENROUTER_API_KEY` | SecureString (si `LLM_PROVIDER=openrouter`) |
| `LLM_PROVIDER` | `/cinco-wiki/<stage>/LLM_PROVIDER` | String (défaut `openai`) |
| `CHAT_MODEL` / `EMBEDDING_MODEL` | `/cinco-wiki/<stage>/…` | String (optionnel) |
| `PUBLIC_APP_URL` | `/cinco-wiki/<stage>/PUBLIC_APP_URL` | String (optionnel — base URL front pour liens chat) |

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

Chat sur les notes publiées via `/ask` (`POST /rag/chat`). Code :
`packages/backend/src/rag`.

| Store | Rôle |
|-------|------|
| **Qdrant** | Recherche sémantique (chunks de notes publiées) |
| **Neo4j** | Graphe social : auteurs, tags, liens, votes, commentaires |

Sans `QDRANT_URL` / clé LLM, l'assistant est désactivé — le reste du wiki fonctionne.
Sans Neo4j (`NEO4J_*`), le chat vectoriel reste disponible ; les tools graphe sont soft-fail.

**Documentation reprise (sync, agent, deploy, tools, LLM, front↔back) :**
[`docs/rag/README.md`](docs/rag/README.md).

### Démarrage local (résumé)

```bash
npm run qdrant:up
# .env : QDRANT_URL, OPENAI_API_KEY, NEO4J_URI/USER/PASSWORD (+ MONGODB_URI, JWT_SECRET…)
npm run rag:sync
npm run dev
npm run frontend          # UI /ask
```

| Script | Action |
|--------|--------|
| `npm run qdrant:up` / `qdrant:down` | Stack Docker **dev** |
| `npm run rag:prod:up` / `rag:prod:down` | Stack Docker **prod** |
| `npm run rag:sync` | Reindex complet (CLI) |

Health : `GET /rag/health` (JWT) → `{ qdrant, neo4j, graphConfigured }`.

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
