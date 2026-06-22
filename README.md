# Cinco Wiki

Application web collaborative de prise de notes — espace commun, notes en rich-text,
votes (étoiles), commentaires, tags, recherche full-text. Cf. `Cinco_Wiki_Spec_Fonctionnelle.md`.

## Architecture

Monorepo npm workspaces, deux déployables :

```
Netlify                         AWS eu-west-3 (Serverless Framework)
┌─────────────┐   REST/JWT      ┌──────────────────────────────┐
│  Next.js    │ ───────────────►│  API Gateway → Lambda (Hono)  │
│ (frontend)  │                 │     ├── MongoDB Atlas          │
└─────────────┘                 │     └── S3 (images)            │
                                └──────────────────────────────┘
```

| Package | Rôle |
|---|---|
| `packages/shared` | Contrat d'API : types + règles (`LIMITS`, helpers). Source de vérité. |
| `packages/backend` | App Hono unique sur Lambda (router interne), MongoDB, S3, OG. |
| `packages/frontend` | Next.js App Router + Tailwind + TipTap + SWR. |

- `serverless.yml` — infra backend (API Gateway HTTP API, Lambda, S3, IAM).
- `docs/CONTRACT_API.md` — règles métier par endpoint.
- `docs/CONTRACT_FRONTEND.md` — props des composants + routing.

## Prérequis

- Node 20+
- Un cluster **MongoDB Atlas** (URI), idéalement avec un index Atlas Search.
- Compte AWS configuré (`aws configure`) pour le déploiement.
- Serverless Framework v3 (installé en devDependency ; pas de compte requis).

## Installation

```bash
npm install
```

## Backend (Serverless Framework)

Les secrets vivent dans **SSM Parameter Store** (clés `/cinco-wiki/<stage>/<NOM>`).
Renseigner un `.env` à la racine (cf. `.env.example`) puis pousser une fois par stage :

```bash
cp .env.example .env          # renseigner MONGODB_URI, JWT_SECRET, CORS_ORIGINS...
npm run secrets:set dev       # ./scripts/set-secrets.sh dev — pousse .env vers SSM
```

Détail des paramètres SSM créés :

| Variable Lambda | Paramètre SSM | Type |
|---|---|---|
| `MONGODB_URI` | `/cinco-wiki/<stage>/MONGODB_URI` | SecureString |
| `JWT_SECRET` | `/cinco-wiki/<stage>/JWT_SECRET` | SecureString |
| `MONGODB_DB` | `/cinco-wiki/<stage>/MONGODB_DB` | String (défaut `cinco-wiki`) |
| `CORS_ORIGINS` | `/cinco-wiki/<stage>/CORS_ORIGINS` | String (défaut `*`) |

`BUCKET_NAME` est dérivé automatiquement (`cinco-wiki-uploads-<stage>`) ;
surchargeable via `--param="bucketName=..."`.

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
npm run dev                        # http://localhost:3000
```

Déploiement Netlify : base `packages/frontend`, plugin `@netlify/plugin-nextjs`
(cf. `packages/frontend/netlify.toml`). Définir `NEXT_PUBLIC_API_URL` dans l'env Netlify.

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
