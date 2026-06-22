# Graph Report - .  (2026-06-22)

## Corpus Check
- Corpus is ~33,230 words - fits in a single context window. You may not need a graph.

## Summary
- 535 nodes · 979 edges · 31 communities (23 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend Core & Auth Layer|Backend Core & Auth Layer]]
- [[_COMMUNITY_Document Upload Component|Document Upload Component]]
- [[_COMMUNITY_Frontend Package Dependencies|Frontend Package Dependencies]]
- [[_COMMUNITY_API Contracts & Frontend Patterns|API Contracts & Frontend Patterns]]
- [[_COMMUNITY_Shared Type System|Shared Type System]]
- [[_COMMUNITY_Frontend TypeScript Config|Frontend TypeScript Config]]
- [[_COMMUNITY_Note Content & XSS Sanitization|Note Content & XSS Sanitization]]
- [[_COMMUNITY_Root Build & Serverless Config|Root Build & Serverless Config]]
- [[_COMMUNITY_Backend AWS Dependencies|Backend AWS Dependencies]]
- [[_COMMUNITY_Search, Filters & Tag UI|Search, Filters & Tag UI]]
- [[_COMMUNITY_Modal & Overlay Layer|Modal & Overlay Layer]]
- [[_COMMUNITY_App Shell & Navigation|App Shell & Navigation]]
- [[_COMMUNITY_User Avatar & Comments UI|User Avatar & Comments UI]]
- [[_COMMUNITY_Admin UI & Loading States|Admin UI & Loading States]]
- [[_COMMUNITY_Base TypeScript Config|Base TypeScript Config]]
- [[_COMMUNITY_Home Feed & Dashboard|Home Feed & Dashboard]]
- [[_COMMUNITY_Note Card & Notifications|Note Card & Notifications]]
- [[_COMMUNITY_Shared Package Manifest|Shared Package Manifest]]
- [[_COMMUNITY_Backend TypeScript Config|Backend TypeScript Config]]
- [[_COMMUNITY_Admin Seed Script|Admin Seed Script]]
- [[_COMMUNITY_Frontend App Pages|Frontend App Pages]]
- [[_COMMUNITY_Claude Code Settings|Claude Code Settings]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Tailwind CSS Config|Tailwind CSS Config]]
- [[_COMMUNITY_Backend Package JSON|Backend Package JSON]]
- [[_COMMUNITY_Tailwind Config File|Tailwind Config File]]
- [[_COMMUNITY_Root Package JSON|Root Package JSON]]
- [[_COMMUNITY_Shared Build Excerpt|Shared Build Excerpt]]
- [[_COMMUNITY_Shared Package JSON|Shared Package JSON]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 35 edges
2. `useAuth()` - 22 edges
3. `fullName()` - 19 edges
4. `collections` - 18 edges
5. `compilerOptions` - 17 edges
6. `api` - 15 edges
7. `compilerOptions` - 14 edges
8. `Spinner()` - 12 edges
9. `Backend Entry Point (Hono App)` - 12 edges
10. `UserManagementTable Component` - 12 edges

## Surprising Connections (you probably didn't know these)
- `TipTap HTML XSS Sanitization` --semantically_similar_to--> `Denormalized Counters Pattern (avgRating, voteCount, commentCount, tagCount)`  [AMBIGUOUS] [semantically similar]
  packages/backend/src/lib/sanitize.ts → packages/backend/src/lib/db.ts
- `Frontend Component Contract (CONTRACT_FRONTEND.md)` --references--> `AuthContext and AuthProvider`  [EXTRACTED]
  docs/CONTRACT_FRONTEND.md → packages/frontend/src/lib/auth-context.tsx
- `Backend API Contract (CONTRACT_API.md)` --references--> `Shared Package Exports (DTOs, LIMITS, helpers)`  [EXTRACTED]
  docs/CONTRACT_API.md → packages/shared/src/index.ts
- `Frontend Component Contract (CONTRACT_FRONTEND.md)` --references--> `Shared Package Exports (DTOs, LIMITS, helpers)`  [EXTRACTED]
  docs/CONTRACT_FRONTEND.md → packages/shared/src/index.ts
- `seed-admin.mjs Script` --references--> `Shared Package Exports (DTOs, LIMITS, helpers)`  [INFERRED]
  scripts/seed-admin.mjs → packages/shared/src/index.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Notification Fan-Out: comments, votes, and user creation all call createNotification** — routes_comments, routes_votes, routes_users, routes_notifications_createnotification [EXTRACTED 0.95]
- **Auth Middleware Chain: withDb → requireAuth → requireAdmin applied in sequence** — lib_http_withdb, lib_http_requireauth, lib_http_requireadmin [EXTRACTED 0.95]
- **Note Write Pipeline: sanitizeContent + htmlToText + resolveLinks + adjustTagCounts on every create/update** — lib_sanitize_sanitizecontent, lib_sanitize_htmltotext, routes_notes_resolvelinks, routes_notes_adjusttagcounts [EXTRACTED 0.90]
- **Note Creation and Editing Flow** — notes_new_newnotepage, notes_id_edit_editnotepage, components_noteeditor [EXTRACTED 1.00]
- **Note Detail View with Media and Interaction** — components_notemodal, components_lightbox, components_commentssection [EXTRACTED 1.00]
- **Shared S3 Presigned Upload Pattern** — components_imageuploader, components_documentuploader, concept_presigned_upload [EXTRACTED 1.00]
- **Shared Contract as Single Source of Truth for Frontend, Backend and Docs** — shared_index, lib_api, docs_contractapi [EXTRACTED 1.00]
- **Auth Session Management: AuthContext + TokenStore + API Client** — lib_authcontext, lib_tokenstore, lib_api [EXTRACTED 1.00]
- **Tag UI System: TagBadge + TagInput + SearchFilters** — tagbadge_tagbadge, taginput_taginput, searchfilters_searchfilters [INFERRED 0.85]

## Communities (31 total, 8 thin omitted)

### Community 0 - "Backend Core & Auth Layer"
Cohesion: 0.06
Nodes (74): Backend Entry Point (Hono App), Denormalized Counters Pattern (avgRating, voteCount, commentCount, tagCount), JWT Access/Refresh Token Rotation Pattern, Soft Author Deletion (null authorId = deleted user), AccessClaims, generateTempPassword(), hashPassword(), RefreshClaims (+66 more)

### Community 1 - "Document Upload Component"
Cohesion: 0.05
Nodes (30): DocumentMime, DocumentUploader(), DocumentUploaderProps, formatBytes(), formatBytes(), ImageMime, ImageUploader(), ImageUploaderProps (+22 more)

### Community 2 - "Frontend Package Dependencies"
Cohesion: 0.05
Nodes (42): dependencies, @cinco-wiki/shared, clsx, date-fns, lucide-react, next, react, react-dom (+34 more)

### Community 3 - "API Contracts & Frontend Patterns"
Cohesion: 0.09
Nodes (37): Optimistic UI Update Pattern, Refresh Token Deduplication Pattern, Shared Contract — Single Source of Truth for DTOs and Rules, Backend API Contract (CONTRACT_API.md), Frontend Component Contract (CONTRACT_FRONTEND.md), README — Architecture & Deployment Guide, Cinco Wiki Functional Specification, Serverless Framework Config (serverless.yml) (+29 more)

### Community 4 - "Shared Type System"
Cohesion: 0.06
Nodes (37): ApiError, AuthTokens, buildExcerpt(), ChangePasswordInput, Comment, CommentInput, CreateUserInput, DOCUMENT_MIME (+29 more)

### Community 5 - "Frontend TypeScript Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 6 - "Note Content & XSS Sanitization"
Cohesion: 0.10
Nodes (16): TipTap HTML XSS Sanitization, htmlToText(), OPTIONS, sanitizeContent(), attachmentSchema, imageSchema, listQuerySchema, noteInputSchema (+8 more)

### Community 7 - "Root Build & Serverless Config"
Cohesion: 0.09
Nodes (22): description, devDependencies, esbuild, serverless, serverless-esbuild, serverless-offline, typescript, name (+14 more)

### Community 8 - "Backend AWS Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, bcryptjs, cheerio, @cinco-wiki/shared, hono, jose (+13 more)

### Community 9 - "Search, Filters & Tag UI"
Cohesion: 0.14
Nodes (15): CommentForm(), SearchFilters(), SearchFiltersProps, SORT_OPTIONS, TagBadge(), TagBadgeProps, CreateUserModal(), MenuItem() (+7 more)

### Community 10 - "Modal & Overlay Layer"
Cohesion: 0.13
Nodes (13): RootLayout, Lightbox(), LightboxProps, Modal(), ModalProps, SIZE, NoteModalProps, VoteSection() (+5 more)

### Community 11 - "App Shell & Navigation"
Cohesion: 0.17
Nodes (10): AppLayout(), metadata, CommentsSection(), NavBar(), tokenStore, AuthContext, AuthProvider(), AuthState (+2 more)

### Community 12 - "User Avatar & Comments UI"
Cohesion: 0.19
Nodes (14): Avatar(), AvatarProps, SIZE, CommentForm Component, CommentItem Component, CommentItem(), NoteModal(), DeleteUserModal() (+6 more)

### Community 13 - "Admin UI & Loading States"
Cohesion: 0.19
Nodes (10): AdminPage(), EmptyState(), EmptyStateProps, SIZE, Spinner(), SpinnerProps, UserManagementTable(), Tag Cloud with Proportional Sizing (+2 more)

### Community 14 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution (+7 more)

### Community 15 - "Home Feed & Dashboard"
Cohesion: 0.21
Nodes (5): HomePage, NotesDashboard(), NotesDashboardProps, Keyset/Cursor Pagination (base64url encoded cursor), TagPage

### Community 16 - "Note Card & Notifications"
Cohesion: 0.27
Nodes (8): NoteCard(), NoteCardProps, NotificationsBell(), SIZE, Stars(), StarsProps, relativeDate(), roundHalf()

### Community 17 - "Shared Package Manifest"
Cohesion: 0.20
Nodes (9): exports, main, name, private, scripts, typecheck, type, types (+1 more)

### Community 18 - "Backend TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, noEmit, types, extends, include

### Community 19 - "Admin Seed Script"
Cohesion: 0.43
Nodes (6): __dirname, generatePassword(), loadDotEnv(), main(), parseArgs(), REPO_ROOT

### Community 20 - "Frontend App Pages"
Cohesion: 0.50
Nodes (4): Admin Dashboard Page, Admin Users Management Page, App Layout (auth guard + NavBar), Note Detail Page ([id]/page.tsx)

## Ambiguous Edges - Review These
- `Denormalized Counters Pattern (avgRating, voteCount, commentCount, tagCount)` → `TipTap HTML XSS Sanitization`  [AMBIGUOUS]
  packages/backend/src/lib/sanitize.ts · relation: semantically_similar_to

## Knowledge Gaps
- **249 isolated node(s):** `allow`, `name`, `version`, `private`, `description` (+244 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Denormalized Counters Pattern (avgRating, voteCount, commentCount, tagCount)` and `TipTap HTML XSS Sanitization`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `Keyset/Cursor Pagination (base64url encoded cursor)` connect `Home Feed & Dashboard` to `Document Upload Component`, `Note Content & XSS Sanitization`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `normalizeTag()` connect `Document Upload Component` to `Shared Type System`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `TagInput()` connect `Document Upload Component` to `Search, Filters & Tag UI`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Core & Auth Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.056886898096304594 - nodes in this community are weakly interconnected._
- **Should `Document Upload Component` be split into smaller, more focused modules?**
  _Cohesion score 0.0545790934320074 - nodes in this community are weakly interconnected._