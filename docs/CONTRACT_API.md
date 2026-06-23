# Contrat API backend — règles par endpoint

> Source de vérité des **routes/méthodes/shapes** : `packages/frontend/src/lib/api.ts`.
> Source de vérité des **types** : `packages/shared/src/index.ts`.
> Helpers backend : `packages/backend/src/lib/http.ts`, `lib/db.ts`, `lib/auth.ts`,
> `lib/relations.ts`, `lib/sanitize.ts`, `models/index.ts`. Pattern de référence :
> `packages/backend/src/routes/auth.ts`.

Chaque module exporte `export const xRoutes = new Hono<AppEnv>()`. Le montage et
le middleware `requireAuth` global sont déjà câblés dans `src/index.ts` — **ne pas**
remettre `requireAuth` sur tout le routeur, sauf besoin de `requireAdmin`.

Toujours : valider l'entrée avec Zod via `body(c, schema)`, lever les erreurs via
`errors.*`, mapper les docs en DTO via `models/*`, résoudre les auteurs via
`authorResolver`. `c.get("userId")` = id courant, `c.get("role")` = rôle, `c.get("db")` = Db.

## users.ts  (toutes admin sauf /me/*)
- `GET /users?q=` → `Paginated<UserAdmin>` (recherche nom/email, tri createdAt desc). **requireAdmin**.
- `POST /users` (`CreateUserInput`) → `UserWithTempPassword`. Génère mot de passe via `generateTempPassword`, hash, email unique (409 sinon), `tokenVersion:0`, `status:active`. Crée notification `account_created` au nouvel utilisateur. **requireAdmin**.
- `PUT /users/:id` (`UpdateUserInput`) → `UserAdmin`. Changer profil/role/status. Désactiver = `status:disabled` + incrémenter `tokenVersion` (coupe les sessions). Notif `account_updated` au concerné. **requireAdmin**.
- `POST /users/:id/reset-password` → `UserWithTempPassword`. Nouveau mdp temporaire + incrément `tokenVersion`. **requireAdmin**.
- `DELETE /users/:id` → 204. Suppression définitive ; les notes/commentaires sont **conservés** : passer `authorId:null` sur ses notes & commentaires (auteur → « Utilisateur supprimé »). Interdire l'auto-suppression de l'admin courant (400). **requireAdmin**.
- `PUT /users/me/profile` (`UpdateProfileInput`) → `UserSelf`. L'utilisateur courant modifie prénom/nom/avatar. (PAS admin.)
- `PUT /users/me/password` (`ChangePasswordInput`) → 204. Vérifier `currentPassword`, hasher le nouveau. (PAS admin.)

## notes.ts
- `GET /notes` (query `NoteQuery`) → `Paginated<NoteCard>`. Visibilité : `status:published` pour tous ; un brouillon n'est visible que dans `mine=true` du propriétaire. Filtres : `q` (recherche titre+contentText, regex insensible casse ou `$text`), `tags` (ET — `$all`), `authorId`, `dateFrom/dateTo` (sur createdAt), `sort` (recent=createdAt desc, oldest asc, top_rated=avgRating desc, most_commented=commentCount desc). `mine=true` → `authorId = courant` (inclut ses brouillons). Pagination par curseur (id+valeur de tri ; simple : cursor = dernier `_id`, limite défaut 24).
- `GET /notes/:id` → `Note` complet. 404 si introuvable. Brouillon : visible seulement par auteur ou admin (403/404 sinon). Inclure `myVote` (vote du courant).
- `POST /notes` (`NoteInput`) → `Note`. authorId = courant. Sanitiser `contentHtml` via `sanitizeContent`, dériver le corps via `htmlToText`. Normaliser tags (`normalizeTag`, dédup, max `LIMITS.tagsPerNote`) et mettre à jour les compteurs `tags` (+1, upsert). Résoudre les `links` (URLs) en `LinkPreview[]` via l'OG (réutiliser logique de og.ts ; max `LIMITS.linksPerNote`). Valider images (max `LIMITS.imagesPerNote`). Compteurs init à 0.
  - **Résumé de lien (création uniquement)** : si un lien externe est présent, invoquer sync la Lambda Python `linkSummarizer` (`lib/link-summarizer-client.ts`) avec l'URL + métadonnées OG. En cas de succès, préfixer `contentText` : `{résumé}\n\n{corps TipTap}` (~300 car., français, modèle `gpt-5-nano`). Best effort : si échec ou timeout (22 s côté caller), sauvegarder sans préfixe et créer une notification `link_summary_failed` à l'auteur (`createNotification`). Pas de re-résumé à la modification.
- `PUT /notes/:id` (`NoteInput`) → `Note`. **Auteur ou admin uniquement** (403 sinon, cf §6.7). Recalcule `contentText` à partir du corps TipTap via `preserveContentTextPrefix` (`lib/content-text.ts`) : conserve le préfixe résumé déjà stocké dans `contentText` (même si le lien est supprimé). Ajuste les compteurs de tags (retirer anciens, ajouter nouveaux). **Pas** d'appel au summarizer.
- `DELETE /notes/:id` → 204. Auteur ou admin. Supprimer votes & commentaires liés, décrémenter compteurs de tags.

## votes.ts  (vote possible uniquement depuis le détail ; toute note publiée, y compris la sienne)
- `PUT /votes/:noteId` (`VoteInput` 1..5) → `Note` (note mise à jour avec `myVote`). Upsert (1 vote/user/note). Recalculer `avgRating`/`voteCount` sur la note (agrégation ou maj incrémentale). Créer notif `vote_on_note` à l'auteur (si ≠ votant et auteur existe).
- `DELETE /votes/:noteId` → `Note`. Retire le vote, recalcule.

## comments.ts  (à plat, 1 niveau, tri ancien→récent)
- `GET /comments/:noteId` → `Comment[]` (résoudre auteurs).
- `POST /comments/:noteId` (`CommentInput`, max `LIMITS.commentMax`) → `Comment`. Incrémente `commentCount` de la note. Notif `comment_on_note` à l'auteur de la note (si ≠ commentateur).
- `PUT /comments/item/:id` (`CommentInput`) → `Comment`. Auteur du commentaire uniquement.
- `DELETE /comments/item/:id` → 204. Auteur du commentaire, **ou** auteur de la note, **ou** admin. Décrémente `commentCount`.

## tags.ts
- `GET /tags` → `Tag[]` (tri count desc).
- `POST /tags/merge` (`{from, into}`) → 204. **requireAdmin**. Remplace `from` par `into` dans toutes les notes, fusionne les compteurs.
- `PUT /tags/:name` (`{to}`) → 204. **requireAdmin**. Renomme partout.
- `DELETE /tags/:name` → 204. **requireAdmin**. Retire le tag de toutes les notes.

## notifications.ts  (destinataire = courant)
- `GET /notifications` → `Notification[]` (récentes d'abord).
- `POST /notifications/:id/read` → 204.
- `POST /notifications/read-all` → 204.
- Helper exporté `createNotification(db, userId, type, message, noteId?)` réutilisé par les autres routes — **le créer ici et l'exporter** ; users/notes/votes/comments l'importent.
- Types : `comment_on_note`, `vote_on_note`, `account_created`, `account_updated`, `link_summary_failed` (échec du résumé automatique d'un lien à la création de note).

## linkSummarizer (Lambda Python, pas de route HTTP)
- Handler : `lambdas/link-summarizer/handler.summarize`. Invoquée en sync par `POST /notes` via `@aws-sdk/client-lambda` (`lib/link-summarizer-client.ts`). Config : `python3.11`, arm64, 1024 MB, timeout 25 s. Secret `OPENAI_API_KEY` (SSM).
- Entrée : `{ url, ogTitle?, ogDescription? }`. Fetch HTML (httpx + BeautifulSoup, timeout 8 s) + métadonnées OG → OpenAI Chat (`gpt-5-nano`, fallback `gpt-4.1-nano`). Sortie : `{ summary }` ou `{ error }`. Résumé tronqué à ~300 car., français.

## uploads.ts
- `POST /uploads/presign` (`PresignUploadInput`) → `PresignUploadResult`. Vérifier MIME ∈ `IMAGE_MIME`, taille ≤ `LIMITS.imageMaxBytes`. Générer une clé `notes/{userId}/{uuid}-{filename}`, URL pré-signée PUT S3 (`@aws-sdk/s3-request-presigner`), `publicUrl` = URL publique du bucket (`env.bucket`, `env.region`).

## og.ts
- `GET /og?url=` → `LinkPreview`. Fetch HTML, parser balises Open Graph via `cheerio` (`og:title/description/image`, fallback `<title>`/meta description), `domain` = hostname. Timeout court, tolérant aux erreurs (champs null). **Exporter `fetchOgPreview(url): Promise<LinkPreview>`** réutilisé par notes.ts.
