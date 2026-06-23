# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code exploration

This project has a graphify knowledge graph at `graphify-out/graph.json`. Use it for all code exploration instead of grepping files:

```bash
graphify query "how does authentication work"
graphify query "what calls createNotification"
graphify path "NoteEditor" "sanitizeContent"
graphify explain "authorResolver"
```

The graph auto-updates on `git commit`, `git pull`, and `git checkout`. To rebuild manually: `/graphify .`

## Commands

```bash
# Install
npm install

# Dev servers (run concurrently in separate terminals)
npm run dev          # backend: serverless offline → http://localhost:3000
npm run frontend     # frontend: next dev → http://localhost:3001 (or next available port)

# Type checking (all packages)
npm run typecheck

# Individual package typecheck
npm run typecheck --workspace packages/backend
npm run typecheck --workspace packages/frontend
npm run typecheck --workspace packages/shared

# Build shared package (needed before backend/frontend can use it)
npm run build:shared

# Deploy
npm run deploy:dev   # serverless deploy --stage dev
npm run deploy       # serverless deploy --stage production

# Seed first admin
MONGODB_URI="mongodb+srv://..." npm run seed:admin
```

Frontend lint:
```bash
cd packages/frontend && npm run lint
```

There are no automated tests in this project.

## Architecture

npm workspaces monorepo with two deployables: Next.js on Netlify (frontend), Hono on AWS Lambda via Serverless Framework (backend).

```
packages/shared    → types, LIMITS constants, normalizeTag(), buildExcerpt()
packages/backend   → Hono Lambda handler, MongoDB, S3
packages/frontend  → Next.js App Router, TipTap, SWR
```

### Shared package — the contract

`packages/shared/src/index.ts` is the single source of truth for all DTOs, enums, and business rules. Both `CONTRACT_API.md` and `CONTRACT_FRONTEND.md` reference it. When changing data shapes, start here. The package must be built (`npm run build:shared`) before backend or frontend can consume changes.

### Backend

**Entry point**: `packages/backend/src/index.ts` — one Hono app, mounted on a single Lambda. Middleware chain: CORS → `withDb` (injects `db` into context) → `requireAuth` (injects `userId`, `role`). `requireAdmin` is applied per-router, not globally.

**Key lib files**:
- `lib/http.ts` — `AppEnv` type, `HttpError`, `errors.*` helpers, `body(c, schema)` for Zod parsing, middlewares
- `lib/db.ts` — MongoDB documents (`UserDoc`, `NoteDoc`, etc.), `collections` accessor, connection pool cached across Lambda invocations
- `lib/auth.ts` — JWT access/refresh tokens via `jose`, bcrypt password hashing
- `lib/sanitize.ts` — `sanitizeContent()` (sanitize-html for TipTap HTML) + `htmlToText()` — called on every note write
- `lib/content-text.ts` — `composeContentText()`, `preserveContentTextPrefix()` — résumé de lien préfixé dans `contentText`
- `lib/link-summarizer-client.ts` — invoke sync Lambda Python `linkSummarizer`
- `lib/relations.ts` — `authorResolver()` for resolving `authorId → UserPublic` with soft-delete handling (`null authorId` → "Utilisateur supprimé" placeholder)
- `models/index.ts` — mapper functions (`toNote`, `toNoteCard`, `toUserPublic`, etc.) — always use these before returning to client, never expose raw docs

**Route pattern**: each route file exports `const xRoutes = new Hono<AppEnv>()`. Input validated with `body(c, zSchema)`. Errors via `errors.unauthorized/forbidden/notFound/badRequest/conflict`. Authors resolved via `authorResolver`. Notifications created via `createNotification()` exported from `routes/notifications.ts`.

**Denormalized counters**: `NoteDoc` stores `avgRating`, `voteCount`, `commentCount` updated in place on every vote/comment mutation. `tags` collection stores per-tag `count` updated on note create/update/delete.

**Note write pipeline** (create): `sanitizeContent` → `resolveLinks` (OG) → si lien présent : invoke sync `linkSummarizer` (Python, gpt-5-nano) → `contentText = résumé + "\n\n" + htmlToText(html)` (best effort ; notif `link_summary_failed` si échec) → normaliser tags → adjust tag counters.

**Note write pipeline** (update): `sanitizeContent` → `preserveContentTextPrefix` (conserve le résumé dans `contentText` même sans lien) → `resolveLinks` → normaliser tags → adjust tag counters. Pas de re-résumé.

### Frontend

**Auth**: `packages/frontend/src/lib/auth-context.tsx` wraps the app. `useAuth()` is the primary hook (22 consumers). Token storage: access token in memory, refresh token in `localStorage`. Transparent 401→refresh with deduplication in `api.ts`.

**API client**: `packages/frontend/src/lib/api.ts` — fully typed against shared DTOs. All backend calls go through this singleton. `ApiClientError` carries `status`, `code`, `details` from the server `ApiError` shape.

**Data fetching**: SWR for all GET requests in components. `api.*` methods used directly for mutations.

**Routing** (App Router):
- `/` → `NotesDashboard` (feed with `SearchFilters`)
- `/[id]` → same dashboard with `NoteModal` opened (shareable note URL)
- `/notes/new`, `/notes/[id]/edit` → `NoteEditor` (TipTap rich text)
- `/admin`, `/admin/utilisateurs` → admin-only pages
- `/tags`, `/tags/[tag]` → tag browsing
- `/profil` → `UserSelf` profile + password change

**Utilities**:
- `cn()` from `lib/cn.ts` — className merge (clsx wrapper), used in every component
- `lib/format.ts` — date formatting helpers

### Infrastructure

Secrets live in AWS SSM Parameter Store at `/cinco-wiki/<stage>/<KEY>`. Push with `npm run secrets:set` (reads `.env`). Backend reads them at Lambda cold start via `lib/env.ts`. Never hardcode secrets; never commit `.env`.

Lambdas : `api` (Hono, Node.js) + `linkSummarizer` (Python 3.11, `lambdas/link-summarizer/`, OpenAI via `OPENAI_API_KEY` SSM). L'API invoque `linkSummarizer` en sync à la création de note avec lien.

S3 bucket (`cinco-wiki-uploads-<stage>`) serves images and attachments publicly. Upload flow: frontend calls `POST /uploads/presign` → gets presigned PUT URL → uploads directly to S3 → stores the `publicUrl` in the note.

MongoDB fallback text search (`$text`) is available if Atlas Search is not configured; Atlas Search index on `title` + `contentText` is preferred.

## Key Invariants

- `authorId: null` on notes/comments means deleted user — always handle this in mappers and UI
- Cursor pagination uses MongoDB `_id` as cursor (base64url encoded), default limit 24
- Tag names are normalized via `normalizeTag()` (trim, lowercase, collapse spaces) before storage and lookup — always normalize before querying
- Content HTML from TipTap must be sanitized server-side via `sanitizeContent()` before storage; `contentText` is always derived server-side (corps TipTap + éventuel préfixe résumé de lien à la création)
- Access tokens are short-lived; refresh tokens respect `tokenVersion` on `UserDoc` — incrementing `tokenVersion` (on disable/reset-password) invalidates all existing sessions
