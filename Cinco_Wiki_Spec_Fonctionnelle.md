# Cinco Wiki — Spécification Fonctionnelle

**Application collaborative de prise de notes**
Version 1.0 — Juin 2026

---

| Champ | Valeur |
|---|---|
| Statut | Brouillon pour validation |
| Plateforme cible | Web uniquement (navigateur) |
| Visibilité des notes | Espace commun — toutes les notes sont visibles par tous |
| Système de vote | 1 à 5 étoiles — note moyenne affichée |
| Commentaires | Simples, à plat (1 niveau) |
| Recherche | Full-text (titre + contenu de la note) |
| Étiquettes | Tags libres créés par les utilisateurs + catégories |

---

## Table des matières

1. [Introduction et Objectifs](#1-introduction-et-objectifs)
2. [Acteurs du Système](#2-acteurs-du-système)
3. [Authentification et Gestion des Comptes](#3-authentification-et-gestion-des-comptes)
4. [Tableau de Bord — Liste des Notes](#4-tableau-de-bord--liste-des-notes)
5. [Détail d'une Note — Modal et URL Partageable](#5-détail-dune-note--modal-et-url-partageable)
6. [Création et Édition d'une Note](#6-création-et-édition-dune-note)
7. [Système de Tags et Catégories](#7-système-de-tags-et-catégories)
8. [Système de Votes (Étoiles)](#8-système-de-votes-étoiles)
9. [Système de Commentaires](#9-système-de-commentaires)
10. [Navigation et Expérience Utilisateur](#10-navigation-et-expérience-utilisateur)
11. [Notifications](#11-notifications)
12. [Synthèse des Règles Métier](#12-synthèse-des-règles-métier)
13. [Exigences Non Fonctionnelles](#13-exigences-non-fonctionnelles)
14. [Stack Technique Recommandée](#14-stack-technique-recommandée)
15. [Phases de Développement Suggérées](#15-phases-de-développement-suggérées)

---

## 1. Introduction et Objectifs

Cinco Wiki est une application web collaborative permettant à une communauté d'utilisateurs gérés par un administrateur de créer, enrichir, organiser et commenter des notes partagées. Elle s'inspire de l'ergonomie de Google Keep tout en ajoutant une dimension sociale (votes, commentaires) et un éditeur de contenu riche.

### Objectifs principaux

- Offrir un espace de notes partagées accessible à tous les utilisateurs de la plateforme
- Permettre la création de notes enrichies (texte formaté, images, liens)
- Faciliter la découverte et l'évaluation du contenu via les votes et commentaires
- Garantir un contrôle des accès clair : seul le créateur d'une note peut la modifier
- Assurer une administration centralisée des comptes utilisateurs

---

## 2. Acteurs du Système

| Acteur | Description | Accès |
|---|---|---|
| Administrateur | Gestionnaire de la plateforme, unique superutilisateur | Gestion complète des utilisateurs + toutes les fonctionnalités |
| Utilisateur connecté | Membre créé par l'admin, authentifié | Lecture de toutes les notes, création/édition de ses propres notes, vote, commentaire |
| Visiteur anonyme | Non applicable — accès restreint aux utilisateurs connectés | Aucun accès à l'application |

---

## 3. Authentification et Gestion des Comptes

### 3.1 Connexion

L'accès à l'application est conditionné à une authentification. Aucune inscription en libre-service n'est disponible : les comptes sont créés exclusivement par l'administrateur.

**Page de connexion :**

- Champs : adresse e-mail + mot de passe
- Option « Se souvenir de moi » (session persistante 30 jours)
- Aucune fonctionnalité de réinitialisation de mot de passe en libre-service — l'admin réinitialise directement depuis le panneau d'administration
- Message d'erreur générique en cas d'identifiants incorrects (sans préciser lequel est faux)
- Redirection automatique vers le tableau de bord après connexion réussie

### 3.2 Gestion des Comptes par l'Administrateur

L'administrateur dispose d'un panneau dédié pour gérer l'ensemble des utilisateurs de la plateforme.

| Action | Détails |
|---|---|
| Créer un utilisateur | Formulaire : prénom, nom, e-mail, rôle (Utilisateur / Admin), mot de passe temporaire — affiché une seule fois à l'admin pour transmission manuelle |
| Modifier un utilisateur | Mettre à jour le profil, réinitialiser le mot de passe (nouveau mot de passe affiché à l'admin), changer le rôle |
| Désactiver un compte | Le compte est suspendu, l'utilisateur ne peut plus se connecter (les notes sont conservées) |
| Supprimer un compte | Suppression définitive avec confirmation — les notes sont conservées et assignées à « Utilisateur supprimé » |
| Lister les utilisateurs | Tableau paginé avec recherche par nom/e-mail, statut actif/inactif, date de création |

### 3.3 Profil Utilisateur

- Modification du prénom, nom et photo de profil
- Changement du mot de passe (ancien mot de passe requis)
- Affichage du nombre de notes créées, de commentaires et de votes donnés

---

## 4. Tableau de Bord — Liste des Notes

### 4.1 Vue Générale

La page d'accueil après connexion affiche l'ensemble des notes de la plateforme sous forme de cartes (cards) dans une grille responsive. C'est l'espace commun partagé par tous les utilisateurs.

### 4.2 Contenu d'une Card (Aperçu)

| Élément | Description | Affichage |
|---|---|---|
| Titre | Titre complet de la note | Texte en gras, tronqué après 2 lignes si trop long |
| Extrait du contenu | Les 150 premiers caractères du texte (sans balises HTML) | Texte gris, tronqué avec ellipse « … » |
| Tags | Liste des étiquettes associées | Badges colorés, max 3 visibles + « +N » si davantage |
| Auteur | Avatar + nom de l'auteur | Photo de profil miniature + prénom nom |
| Date | Date de création ou dernière modification | Format relatif : « il y a 2 heures », « il y a 3 jours » |
| Note moyenne | Moyenne des votes en étoiles | Icônes étoiles (demi-étoile possible) + nombre de votes |
| Nombre de commentaires | Total des commentaires de la note | Icône bulle + chiffre |
| Preview des images | Aperçu de la première image attachée | Miniature rectangulaire en haut de la carte si image présente |
| Preview des liens | Carte Open Graph du premier lien externe | Image + titre + domaine, style « link preview » |

### 4.3 Interactions sur la Liste

- Clic sur une card → ouverture de la note en modal avec mise à jour de l'URL (`/:id-note`)
- La card du créateur affiche une icône « crayon » pour accéder à l'édition directement
- Scroll infini ou pagination (bouton « Charger plus ») pour les grandes listes

### 4.4 Barre de Recherche et Filtres

| Fonctionnalité | Détail |
|---|---|
| Recherche full-text | Saisie libre — recherche dans le titre ET le contenu (temps réel, délai de frappe 300 ms) |
| Filtre par tag | Sélection d'un ou plusieurs tags dans une liste déroulante (combinaison en ET) |
| Filtre par auteur | Sélection d'un utilisateur dans une liste |
| Filtre par date | Plage de dates (date de création ou de modification) |
| Tri | Options : Plus récentes, Plus anciennes, Mieux notées, Plus commentées |
| Mes notes | Bouton raccourci pour afficher uniquement les notes de l'utilisateur connecté |

---

## 5. Détail d'une Note — Modal et URL Partageable

### 5.1 Comportement du Modal

L'ouverture d'une card déclenche l'affichage d'un modal plein-écran (ou grande largeur). L'URL est simultanément mise à jour vers `/:id-note`, permettant le partage direct du lien et la navigation via les boutons Précédent/Suivant du navigateur.

- La fermeture du modal (bouton ×, clic en dehors ou touche Échap) restaure l'URL de la liste
- L'accès direct à l'URL `/:id-note` affiche la liste en arrière-plan avec le modal ouvert
- Le lien `/:id-note` est copiable via un bouton « Partager »

### 5.2 Contenu Affiché dans le Modal

| Section | Contenu |
|---|---|
| En-tête | Titre complet, auteur (avatar + nom + date), bouton Modifier (si auteur connecté) |
| Tags | Badges de tous les tags associés à la note |
| Corps de la note | Rendu HTML complet du contenu formaté (rich text) |
| Images | Galerie des images attachées, cliquables pour vue agrandie (lightbox) |
| Liens | Cartes de prévisualisation pour chaque lien externe (titre, description, image, domaine) |
| Section votes | Système 1–5 étoiles interactif + moyenne affichée + nombre total de votes |
| Section commentaires | Liste des commentaires + formulaire d'ajout |

---

## 6. Création et Édition d'une Note

### 6.1 Accès à l'Éditeur

- Bouton « + Nouvelle note » toujours visible dans la barre de navigation principale
- Bouton « Modifier » sur la card ou dans le modal (visible uniquement pour l'auteur)
- L'éditeur s'ouvre dans une page dédiée : `/notes/new` ou `/notes/:id/edit`

### 6.2 Champs de la Note

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| Titre | Texte simple | Oui | Champ texte court, max 200 caractères |
| Contenu | Rich Text (éditeur) | Non | Corps principal de la note avec formatage avancé |
| Images | Upload fichiers | Non | Pièces jointes images (voir §6.4) |
| Liens externes | Texte URL | Non | URLs ajoutées manuellement, prévisualisées automatiquement |
| Tags | Multi-sélection + création | Non | Tags libres existants ou nouveaux créés à la volée |

### 6.3 Éditeur de Texte Riche

Le contenu est édité via un éditeur WYSIWYG (ex. TipTap, Quill ou ProseMirror).

| Catégorie | Options disponibles |
|---|---|
| Texte | Gras, Italique, Souligné, Barré, Code inline |
| Titres | H1, H2, H3 dans le corps de la note |
| Listes | Liste à puces, liste numérotée, liste de tâches (checklist) |
| Blocs | Citation (blockquote), bloc de code (avec coloration syntaxique) |
| Alignement | Gauche, centré, droite, justifié |
| Liens | Insertion d'un lien hypertexte avec URL et texte d'affichage |
| Tableau | Insertion d'un tableau simple (ajout/suppression de lignes et colonnes) |
| Couleur | Couleur du texte et couleur de fond (surlignage) |

### 6.4 Gestion des Images

- Upload par glisser-déposer (drag & drop) ou sélection via explorateur de fichiers
- Formats acceptés : JPG, PNG, GIF, WEBP — taille maximale par image : 5 Mo
- Maximum 10 images par note
- Aperçu immédiat après upload dans l'éditeur
- Possibilité de réordonner les images par glisser-déposer
- Possibilité de supprimer une image individuelle
- Les images sont hébergées sur le serveur ou un service de stockage externe (ex. S3)

### 6.5 Gestion des Liens Externes

- Champ dédié pour ajouter une ou plusieurs URLs
- Après validation, le système récupère automatiquement les métadonnées Open Graph (titre, description, image, domaine)
- La preview est affichée sous le champ et sera visible dans la card et le modal
- Maximum 5 liens par note
- Modification et suppression d'un lien individuel

### 6.6 Sauvegarde

- Bouton « Publier » pour créer/mettre à jour la note et revenir à la liste
- Bouton « Enregistrer en brouillon » (la note n'est pas visible dans la liste commune)
- Sauvegarde automatique (autosave) toutes les 60 secondes pendant l'édition
- Indicateur visuel de l'état : « Enregistré », « Enregistrement… », « Erreur »
- Bouton « Annuler » → confirmation si des modifications non sauvegardées existent

### 6.7 Droits de Modification

Seul le créateur d'une note peut la modifier ou la supprimer. L'administrateur peut également modifier ou supprimer n'importe quelle note (rôle de modération).

- Un utilisateur non-auteur peut lire mais pas éditer — le bouton Modifier n'apparaît pas
- Toute tentative d'accès direct à `/notes/:id/edit` par un non-auteur retourne une erreur 403

---

## 7. Système de Tags et Catégories

### 7.1 Fonctionnement des Tags

- Un utilisateur peut ajouter un ou plusieurs tags à sa note lors de la création ou de l'édition
- Les tags sont libres : l'utilisateur tape un mot et le valide (touche Entrée ou virgule)
- Si le tag existe déjà, il est suggéré en auto-complétion
- Un nouveau tag peut être créé à la volée sans intervention de l'administrateur
- Maximum 10 tags par note
- Les tags sont normalisés : minuscules, sans espaces initiaux/finaux

### 7.2 Navigation par Tags

- Clic sur un badge de tag (card ou modal) → filtre automatique de la liste sur ce tag
- Page dédiée `/tags` : liste de tous les tags avec le nombre de notes associées
- Les tags populaires sont mis en avant (nuage de tags ou liste triée par usage)

### 7.3 Administration des Tags

- L'administrateur peut fusionner deux tags (ex. « react » et « reactjs » → « react »)
- L'administrateur peut renommer ou supprimer un tag (avec impact sur toutes les notes associées)

---

## 8. Système de Votes (Étoiles)

### 8.1 Principe

Chaque utilisateur connecté peut attribuer une note de 1 à 5 étoiles à n'importe quelle note (y compris les siennes). La note moyenne est calculée et affichée publiquement.

### 8.2 Règles

- Un utilisateur ne peut voter qu'une fois par note
- Il peut modifier son vote à tout moment (le nouveau vote remplace l'ancien)
- Il peut retirer son vote (le vote est supprimé)
- La note moyenne est recalculée en temps réel après chaque vote
- Le vote n'est possible que depuis le modal de détail de la note

### 8.3 Affichage

| Élément | Affichage |
|---|---|
| Dans la card (liste) | Étoiles en lecture seule + note moyenne arrondie à 0.5 + (N votes) |
| Dans le modal (détail) | Étoiles interactives cliquables + note moyenne + nombre de votes + vote de l'utilisateur mis en évidence |
| Vote de l'utilisateur | Les étoiles correspondant à son propre vote sont affichées dans une couleur distincte (ex. or vs. gris) |

---

## 9. Système de Commentaires

### 9.1 Principe

Les commentaires sont affichés en bas du modal de détail. Ils sont à plat (1 seul niveau, sans réponses imbriquées) et triés du plus ancien au plus récent.

### 9.2 Fonctionnalités

- Tout utilisateur connecté peut commenter une note
- Le commentaire est un texte libre (max 1 000 caractères)
- L'auteur d'un commentaire peut le modifier ou le supprimer
- L'auteur de la note et l'administrateur peuvent supprimer n'importe quel commentaire
- Les commentaires affichent l'avatar, le nom de l'auteur et la date (format relatif)
- Le formulaire d'ajout est en bas de la liste des commentaires
- Un compteur de commentaires est visible dans la card et dans l'en-tête du modal

---

## 10. Navigation et Expérience Utilisateur

### 10.1 Structure de Navigation

| Zone | Élément | Description |
|---|---|---|
| Barre principale | Logo / Accueil | Retour vers la liste des notes |
| Barre principale | Bouton + Nouvelle note | Accès rapide à la création |
| Barre principale | Recherche globale | Champ de recherche full-text |
| Barre principale | Avatar utilisateur | Menu déroulant : Mon profil, Mes notes, Déconnexion |
| Barre principale | Admin (si admin) | Lien vers le panneau d'administration |
| Barre latérale (optionnelle) | Mes notes | Filtre rapide sur les notes de l'utilisateur connecté |
| Barre latérale (optionnelle) | Tags populaires | Nuage de tags pour navigation rapide |

### 10.2 Structure des URLs

| URL | Description |
|---|---|
| `/` | Tableau de bord — liste de toutes les notes |
| `/:id-note` | Tableau de bord avec le modal de la note ouverte |
| `/notes/new` | Éditeur de création d'une nouvelle note |
| `/notes/:id/edit` | Éditeur de modification d'une note existante |
| `/tags` | Page de navigation par tags |
| `/tags/:tag` | Liste des notes filtrées par tag |
| `/profil` | Profil de l'utilisateur connecté |
| `/admin` | Panneau d'administration (admin uniquement) |
| `/admin/utilisateurs` | Gestion des utilisateurs |

### 10.3 Responsive Design

- L'interface est responsive, adaptée aux résolutions desktop (≥ 1024 px), tablette (768 px) et mobile (≤ 767 px)
- En mobile, la grille de cards passe à 1 colonne
- Le modal s'affiche en plein écran sur mobile
- La barre de navigation se replie en menu hamburger sur mobile

---

## 11. Notifications

### 11.1 Notifications In-App

Un centre de notifications accessible depuis la barre de navigation informe l'utilisateur des événements qui le concernent.

| Événement | Destinataire | Message |
|---|---|---|
| Nouveau commentaire sur ma note | Auteur de la note | « [Prénom] a commenté votre note « [Titre] » » |
| Nouveau vote sur ma note | Auteur de la note | « Quelqu'un a noté votre note « [Titre] » : X étoiles » |
| Mon compte a été créé | Nouvel utilisateur | « Bienvenue ! Votre compte a été créé par l'administrateur. » |
| Mon compte a été modifié | Utilisateur concerné | « Votre compte a été modifié par l'administrateur. » |

---

## 12. Synthèse des Règles Métier

| Règle | Détail |
|---|---|
| Accès à l'application | Réservé aux utilisateurs créés par l'admin — pas d'inscription publique |
| Visibilité des notes | Toutes les notes publiées sont visibles par tous les utilisateurs connectés |
| Modification d'une note | Uniquement par l'auteur ou l'administrateur |
| Suppression d'une note | Uniquement par l'auteur ou l'administrateur |
| Vote | 1 vote par utilisateur par note, modifiable, supprimable |
| Commentaire | Texte libre ≤ 1 000 caractères, modifiable/supprimable par son auteur ou l'admin |
| Tags | Libres, max 10 par note, créables à la volée, normalisés en minuscules |
| Images | Max 10 par note, max 5 Mo chacune, formats JPG/PNG/GIF/WEBP |
| Liens | Max 5 par note, prévisualisation Open Graph automatique |
| Brouillons | Visibles uniquement par leur auteur et l'administrateur |
| Compte désactivé | L'utilisateur ne peut plus se connecter, ses notes restent visibles |
| Suppression de compte | Les notes sont conservées et attribuées à « Utilisateur supprimé » |

---

## 13. Exigences Non Fonctionnelles

| Domaine | Exigence |
|---|---|
| Performance | Chargement initial < 3 secondes. Recherche full-text < 500 ms |
| Sécurité | Authentification par token JWT ou session sécurisée. HTTPS obligatoire. Protection CSRF. Validation côté serveur de toutes les entrées |
| Accessibilité | Respect des critères WCAG 2.1 niveau AA. Navigation au clavier. Attributs ARIA sur les composants interactifs |
| Compatibilité navigateurs | Chrome, Firefox, Safari, Edge — versions N-1 minimum |
| Internationalisation | Interface en français par défaut. Architecture prête pour multi-langue |
| Sauvegarde des données | Sauvegardes automatiques quotidiennes de la base de données |
| Montée en charge | Conception pour supporter jusqu'à 500 utilisateurs simultanés |

---

## 14. Stack Technique

| Couche | Technologie | Détail |
|---|---|---|
| Frontend | Next.js + TypeScript | Hébergé sur **Netlify** (pure frontend, pas d'API Routes backend) |
| Éditeur rich text | TipTap (basé sur ProseMirror) | Extensible, open-source, bonne intégration React/Next.js |
| Styles | Tailwind CSS | Productivité, responsive natif, design system cohérent |
| Backend | AWS Lambda + API Gateway | Déployé via **SST v3 (Ion)**, région **eu-west-3 (Paris)** |
| Infrastructure as code | SST v3 (Ion) | TypeScript-first, Live Lambda pour le dev local, déploiement `sst deploy` |
| Base de données | MongoDB Atlas | Cluster **existant** — Atlas Search pour le full-text |
| Stockage fichiers | AWS S3 | Bucket en **eu-west-3**, intégration native Lambda |
| Authentification | JWT + refresh tokens | Stateless, sécurisé, compatible Netlify + Lambda séparés |
| Recherche full-text | MongoDB Atlas Search | Intégré à Atlas, pas d'infrastructure supplémentaire |
| Preview liens | Lambda dédié (scraping OG) | Extraction Open Graph depuis les URLs |

### Architecture de déploiement

```
Netlify                     AWS (eu-west-3)
┌─────────────┐             ┌──────────────────────────────┐
│  Next.js    │  REST API   │  API Gateway                 │
│  (frontend) │ ──────────► │    └── AWS Lambda (SST)      │
│             │             │          └── MongoDB Atlas    │
└─────────────┘             │          └── S3 (images)     │
                            └──────────────────────────────┘
```

---

## 15. Phases de Développement Suggérées

| Phase | Périmètre | Priorité |
|---|---|---|
| MVP — Phase 1 | Authentification, gestion des utilisateurs par l'admin, création/édition de notes (titre + texte riche), liste en cards, modal de détail avec URL | Critique |
| Phase 2 | Upload d'images, gestion des liens avec preview Open Graph, tags et filtres | Haute |
| Phase 3 | Système de votes (étoiles), commentaires, recherche full-text | Haute |
| Phase 4 | Notifications in-app, brouillons, autosave, profil utilisateur enrichi | Moyenne |
| Phase 5 | Administration des tags, navigation par tags (nuage), responsive mobile avancé | Basse |

---

*— Fin du document —*
