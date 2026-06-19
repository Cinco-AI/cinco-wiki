# Contrat frontend — composants & routes

> Types : `@noteshare/shared`. Client API : `@/lib/api` (objet `api`, `ApiClientError`,
> `tokenStore`). Auth : `@/lib/auth-context` (`useAuth()` → `{user, loading, login,
> logout, refreshUser, isAdmin}`). Utils : `@/lib/format` (`relativeDate`, `fullName`,
> `initials`, `roundHalf`), `@/lib/cn` (`cn`). Données : **SWR** (`useSWR`).
> Référence de style : `app/login/page.tsx`. Tous les composants interactifs : `"use client"`.
> Icônes : `lucide-react`. Accent couleur : classes `brand-*`. Langue : **français**.

## Routing (App Router, groupe `(app)` protégé)
Modèle « liste + modal partageable » SANS intercepting routes :
- `app/(app)/layout.tsx` — shell authentifié : garde (redirige vers `/login` si pas connecté, via `useAuth`), rend `<NavBar/>` puis `{children}`.
- `app/(app)/page.tsx` — rend `<NotesDashboard/>`.
- `app/(app)/[id]/page.tsx` — rend `<NotesDashboard openNoteId={params.id}/>` (liste derrière + modal ouverte ; accès direct à l'URL OK, §5.1). Note : `/login`, `/notes`, `/tags`, `/profil`, `/admin` sont des segments statiques prioritaires sur `[id]`.
- `app/(app)/notes/new/page.tsx` — `<NoteEditor mode="create"/>`.
- `app/(app)/notes/[id]/edit/page.tsx` — `<NoteEditor mode="edit" noteId={params.id}/>`.
- `app/(app)/tags/page.tsx` — nuage/liste de tags.
- `app/(app)/tags/[tag]/page.tsx` — `<NotesDashboard initialTag={params.tag}/>`.
- `app/(app)/profil/page.tsx` — profil + changement mdp.
- `app/(app)/admin/page.tsx` — tableau de bord admin (liens).
- `app/(app)/admin/utilisateurs/page.tsx` — gestion utilisateurs.

Navigation modal : ouvrir = `router.push(\`/\${id}\`)` ; fermer = `router.push("/")` (ou `router.back()`). Clic carte → push id. Échap / clic backdrop / × → close.

## Composants (`src/components/`) — props exactes

- `Avatar.tsx` — `Avatar({ user: UserPublic, size?: "sm"|"md"|"lg" })`. Photo ou initiales (`initials`) sur fond `brand`.
- `Stars.tsx` — `Stars({ value: number, max?: 5, size?, interactive?, onRate?(v:number):void, myVote?: number|null })`. Lecture seule (demi-étoiles via `roundHalf`) ou interactif (survol, clic). Vote utilisateur en `brand-500` (or) vs gris (§8.3).
- `TagBadge.tsx` — `TagBadge({ tag: string, onClick?(tag:string):void, active?: boolean })`. Badge cliquable → filtre.
- `NoteCard.tsx` — `NoteCard({ note: NoteCard, onOpen(id:string):void })`. Affiche §4.2 : preview image (haut), titre (2 lignes max), extrait, badges tags (max 3 + « +N »), `Avatar`+nom, `relativeDate`, `Stars` lecture seule + nb votes, icône commentaire + count, preview lien (1er). Icône crayon si `note.author.id === user.id` → `router.push(\`/notes/\${id}/edit\`)`.
- `SearchFilters.tsx` — `SearchFilters({ query: NoteQuery, onChange(q: NoteQuery):void, tags: Tag[], users: UserPublic[] })`. Recherche full-text (debounce 300ms, `LIMITS.searchDebounceMs`), filtre tags (multi, ET), auteur, plage dates, tri, bouton « Mes notes ».
- `NotesDashboard.tsx` — `NotesDashboard({ openNoteId?: string, initialTag?: string })`. "use client". Charge la liste via `useSWR` + `api.listNotes(query)` ; grille responsive (1 col mobile, 2 tablette, 3+ desktop) ; `SearchFilters` ; « Charger plus » via `nextCursor`. Monte `<NoteModal noteId={openNoteId}/>` si défini. Gère ouverture/fermeture par router.
- `NoteModal.tsx` — `NoteModal({ noteId: string, onClose():void })`. Plein écran/large, `animate-scale-in`, fermeture × / backdrop / Échap. Charge `api.getNote(id)`. Affiche §5.2 : en-tête (titre, `Avatar`+nom+date, bouton Modifier si auteur, bouton Partager qui copie `\${location.origin}/\${id}`), tags, corps `dangerouslySetInnerHTML` avec classe `prose-note`, galerie images (lightbox), previews liens, `<VoteSection>`, `<CommentsSection>`. Met à jour l'URL au montage si besoin.
- `VoteSection.tsx` — `VoteSection({ note: Note, onChange(updated: Note):void })`. `Stars` interactif → `api.setVote`/`api.removeVote`, moyenne + nb votes, met en évidence le vote courant.
- `CommentsSection.tsx` — `CommentsSection({ noteId: string })`. `useSWR(api.listComments)`, liste à plat triée ancien→récent (`Avatar`+nom+`relativeDate`), édition/suppression si auteur (ou note-auteur/admin pour suppr), formulaire d'ajout en bas (max `LIMITS.commentMax`).
- `Lightbox.tsx` — `Lightbox({ images: NoteImage[], index: number, onClose():void, onIndex(i:number):void })`.
- `RichTextEditor.tsx` — `RichTextEditor({ value: string, onChange(html:string):void })`. TipTap (`@tiptap/react` + `StarterKit` + Underline, Link, Image, Table(+Row/Header/Cell), TextAlign, TextStyle, Color, Highlight, TaskList, TaskItem). Barre d'outils complète (§6.3). Sortie HTML via `editor.getHTML()`.
- `ImageUploader.tsx` — `ImageUploader({ images: NoteImage[], onChange(imgs: NoteImage[]):void })`. Drag&drop + sélection, valide MIME/taille (`IMAGE_MIME`, `LIMITS`), `api.presignUpload` puis PUT direct S3 (`fetch(uploadUrl, {method:"PUT", body:file})`), réordonnable, suppression, max `LIMITS.imagesPerNote`.
- `LinkManager.tsx` — `LinkManager({ links: string[], onChange(urls:string[]):void })`. Ajout d'URLs, aperçu OG via `api.fetchOg`, suppression, max `LIMITS.linksPerNote`.
- `NoteEditor.tsx` — `NoteEditor({ mode: "create"|"edit", noteId?: string })`. Formulaire complet : titre (max 200), `RichTextEditor`, `LinkManager`, `ImageUploader`, sélecteur de tags (création à la volée, Entrée/virgule, autocomplétion via `api.listTags`, max 10). Boutons Publier / Enregistrer en brouillon / Annuler (confirmation si modifs). Autosave 60s (`LIMITS.autosaveMs`) avec indicateur état. En edit : charge via `api.getNote`, garde 403 (non-auteur → message).
- `NavBar.tsx` — barre principale (§10.1) : logo→`/`, bouton « + Nouvelle note »→`/notes/new`, recherche globale, `<NotificationsBell/>`, menu avatar (Mon profil, Mes notes, Déconnexion), lien Admin si `isAdmin`. Responsive (hamburger mobile).
- `NotificationsBell.tsx` — cloche + badge non-lus, dropdown liste (`api.listNotifications`), marquer lu / tout lu.
- `UserManagementTable.tsx` — pour `/admin/utilisateurs` : table paginée (`api.listUsers`), recherche, créer/modifier/désactiver/supprimer, modale affichant le mot de passe temporaire 1 fois.
- `Spinner.tsx`, `EmptyState.tsx`, `Modal.tsx` (wrapper générique backdrop+Échap) — primitives utilitaires partagées.

Cohérence : arrondis `rounded-lg/xl`, ombres douces, focus ring `brand-200`, transitions `transition`. Réutiliser les primitives, ne pas dupliquer.
