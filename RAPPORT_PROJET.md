# Rapport complet du projet SEED — Plateforme institutionnelle multi-marques

> **Projet** : plateforme web institutionnelle complète (site public + back-office + assistant IA conversationnel)
> **Écosystème** : `seed_backend` (API NestJS) + `seed_frontend` (SPA Angular 17)
> **Commanditaire d'origine** : Yaba-In SARL (https://yaba-in.com) — licence privée
> **Date du rapport** : 20/09/2026

---

## 1. Présentation générale

Le projet « SEED » est une plateforme web institutionnelle destinée à des organisations (ONG, universités, fondations) couvrant quatre piliers : **S**olidarité, **E**ducation, **E**nvironnement, **D**éveloppement — et une variante santé (ASFH : **A**ccès aux soins, **S**anté, **F**ormation, **H**abitat).

La plateforme est **multi-tenant / multi-marques** : le même code sert plusieurs sites (SEED, ASFH, UDM — Université des Montagnes), différenciés uniquement par la configuration (variables d'environnement, fichiers `index.html` de marque, thème CSS dynamique, contenu en base). Le contenu est géré intégralement par un **back-office** sans redéploiement.

La plateforme inclut **AEDIA**, un assistant IA conversationnel public (« l'intelligence artificielle des sommets ») branché sur OpenRouter, alimenté par des fichiers de contexte métier éditables en production, avec streaming SSE, recherche web et recherche documentaire.

---

## 2. Architecture globale

```
┌─────────────────────────────┐       HTTPS / JSON / SSE         ┌──────────────────────────────┐
│  seed_frontend (Angular 17) │ ───────────────────────────────▶ │  seed_backend (NestJS 10)    │
│  • Site public (SPA)        │      cookie JWT « yaccess »      │  • API REST /api             │
│  • Back-office /admin       │ ◀─────────────────────────────── │  • Streaming SSE (AEDIA)    │
│  • Widget AEDIA            │                                   │  • Uploads en /uploads       │
└─────────────────────────────┘                                   └──────────────┬───────────────┘
                                                                                 │ Mongoose
                                                                 ┌───────────────▼───────────────┐
                                                                 │        MongoDB Atlas           │
                                                                 └───────────────────────────────┘
                                           Émet : nodemailer/SMTP (config chiffrée en base)
```

- **Backend** : `seed_backend` — NestJS 10, TypeScript 5.7, Mongoose 8, 193 fichiers TS (~17 000 lignes).
- **Frontend** : `seed_frontend` — Angular 17.3 (composants standalone), ~44 000 lignes (TS + HTML + SCSS).
- **Base de données** : MongoDB Atlas (Mongoose ODM), DB par défaut `seed` (`MONGODB_DB`).
- **Tâches planifiées** : `@nestjs/schedule` (traitement par vagues des campagnes d'annonces).

---

## 3. Spécification technique — Backend (seed_backend)

### 3.1 Bootstrap (`src/main.ts`, `src/app.module.ts`)

| Paramètre | Valeur |
|---|---|
| Préfixe API | `API_PREFIX` (défaut `api`) |
| Cookies | `cookie-parser`, JWT en cookie « yaccess » |
| Cache HTTP | En-tête global `no-store` (sauf `/uploads`) |
| Statique | `express.static` sur `/uploads` |
| CORS | `CLIENT_ORIGIN` (liste séparée par virgules, ou `true`) + `credentials: true` |
| Validation | `ValidationPipe({ whitelist, transform, enableImplicitConversion })` global |
| Throttling | `ThrottlerModule` 100 req/min + gardes globaux `JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard` (via `APP_GUARD`) |
| Modules | 30 modules fonctionnels enregistrés (app.module.ts) |

### 3.2 Modèle de sécurité

- **Authentification** : JWT en **cookie HttpOnly** nommé `yaccess`, `SameSite=None` en production (compatibilité cookie cross-site `seeds.yaba-in.com` ↔ `seeds.racciram.org`), validité 7 jours.
  - `POST /admin/auth/google` — connexion Google (OAuth, `googleClientId` par environnement)
  - `POST /admin/auth/login` — identifiants / mot de passe
  - `POST /admin/auth/2fa/send-code` + `/2fa/verify` — double authentification par code
  - `POST /admin/auth/forgot-password` + `/reset-password` — réinitialisation (jeton temporaire 1 h)
  - `GET /admin/auth/me`, `PATCH /admin/auth/me`, `POST /admin/auth/logout`
- **Comptes** : verrouillage après 5 tentatives échouées pendant 15 min ; codes 2FA à 5 tentatives max ; mots de passe hachés `bcryptjs`.
- **Rôles** (`admin.schema.ts`, `roles.guard.ts`) : `user` < `consultant` < `admin` < `superadmin`. Les routes sensibles sont protégées par `@Roles('admin','superadmin')` ; la plupart des opérations de contenu acceptent le profil `user`/`consultant`.
- **Endpoints publics** : décorateur `@Public()` (ex. `POST /stats/visit`, `POST /contact`, `GET /site-config`, AEDIA avec `OptionalJwtAuthGuard`).
- **Journalisation** : module `audit-log` — journal de toutes les actions admin (action, ressource, acteur, IP, méthode, statut ; filtres Q/action/rôle/période), accès restreint admin/superadmin.

### 3.3 Modules métier et API REST

| Module | Routes principales | Fonctionnalités |
|---|---|---|
| **News** | `GET /news` (public : publiées, tri date), `/news/:id`, CRUD admin | Pagination, recherche regex échappée, suppression HTML + extraits, signature IA retirée dans les listes admin |
| **NewsCategory** | CRUD `/news-categories` | Nom unique insensible à la casse (« Cette catégorie existe déjà ») |
| **Programs** | `GET /programs` (public : tri `order`), CRUD admin | Pagination (limit 1–100), recherche titre/sous-titre |
| **Resources** | `GET /resources` (public : uniquement publiées), CRUD admin | Filtres catégorie/publié, recherche `$or`, pagination |
| **Partners** | `GET /partners` (public : actifs, tri `order`), CRUD admin | Pagination + recherche nom |
| **Events** | CRUD `/events` | Événements avec statuts (à venir / en cours / terminés) |
| **Banner** | CRUD `/banner` | Carrousel de slides (image, titre, CTA, figures/chiffres) |
| **About** | CRUD `/about` | Contenu institutionnel (vision, mission, valeurs, histoire, pays couverts) |
| **Team** | CRUD `/team` + `/team/sections` | Sections d'équipe + membres avec liens sociaux |
| **Impacts** | CRUD `/impacts` | Indicateurs chiffrés (bénéficiaires, projets…) |
| **FeaturesSection** | CRUD `/features-section` | Blocs de fonctionnalités / valeurs |
| **CountriesSection** | CRUD `/countries-section` | Pays couverts |
| **VideoHighlightSection** | CRUD `/video-highlight-section` | Vidéo de présentation (iframe) |
| **Contact** | `POST /contact` (public), liste/lecture/suppression admin | Notification e-mail admin + accusé de réception visiteur |
| **Prospects** | CRUD `/prospects` | Liste d'attente / newsletter, recherche, pagination |
| **Donations** | CRUD `/donations` | Modes de don et moyens de règlement |
| **Recruitments** | CRUD `/recruitments` + `/recruitments/:id/applications` | Campagnes de recrutement à champs dynamiques + candidatures |
| **Users** (admins) | CRUD `/users` | Création avec mot de passe, e-mail d'accueil, verrouillage, activation |
| **Announcements** | CRUD `/announcements`, `/settings` | Campagnes e-mail massives par lots (voir §3.5) |
| **Stats** | `POST /stats/visit` (public), `GET /stats/summary`, `/daily`, `/series`, `/top-pages` | Visites/pageviews, déduplication par visiteur/jour, agrégats |
| **Site** | `GET /site-config` (public), `PUT /site-config` | Configuration globale : segments activés, menu survol, liens sociaux, landing sections, paramètres AEDIA |
| **Upload** | `POST /admin/upload` | Upload d'image (MIME image uniquement, nom `Date.now()`-hex, suppression de l'ancien, URL via `PUBLIC_URL`) |
| **AuditLog** | `GET /audit-logs` | Journal (voir §3.2) |
| **Mail / Smtp / Email / Crypt** | — | Infrastructure e-mail (voir §3.4) |
| **Orizia** | `GET`/`PUT /orizia/settings`, `POST /orizia/ask`, `GET /orizia/visitor/:visitorId`, `GET /orizia/conversations`, `GET /orizia/conversation/:id` | Assistant IA (voir §4) |
| **Seed** | — | Initialisation : site-config par défaut, compte superadmin, données de démo |

### 3.4 Infrastructure e-mail

- **SMTP** : configuration stockée en **base** (module `smtp`) et **chiffrée** (`crypt` : `openRouterApiKey` et identifiants SMTP chiffrés au repos) ; repli sur variables d'environnement (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` 587, `SMTP_SECURE`). Alerte en cas de SMTP non configuré.
- **Modèles e-mail** (`src/modules/mail/templates/`) : HTML complet avec marque personnalisable (couleurs primaire/secondaire, logo, icônes sociales inline SVG) :
  - `contact` : notification admin + confirmation visiteur
  - `account` : envoi des identifiants de compte
  - `recruitment` : candidature reçue (visiteur), notification admin, acceptation, refus
- **Journalisation** : module `email` (collection `email_log`) avec catégories `single` / `announcement`, suivi envoi / rapprochement (`sendMismatchOnly`).

### 3.5 Campagnes d'annonces (e-mailing)

- 5 groupes de destinataires (admins, prospects, e-mails personnalisés…), 5 statuts (`draft → scheduled → sending → sent → failed`), pièces jointes, planification.
- Traitement **par vagues** en tâche planifiée : verrou distribué `announcements-wave-processor` (TTL 30 s), vagues de 20 e-mails (`WAVE_SIZE`), suivi **par destinataire** (`deliveries`).

### 3.6 Recrutement (campagnes & candidatures)

- **Campagne** : fenêtre `start/endDate`, champs de formulaire dynamiques (text/textarea/email/number/url/tel/file), pièces autorisées (`any`/`image`/`document`), taille max 10 Mo, fichier téléchargeable, statuts publié/archivé, duplication de campagne.
- **Candidature** : snapshot des champs remplis, statuts `pending/approved/rejected`, historique de revue (`reviewedBy/reviewedAt/role/note`), index unique `{campaignId, email}` (une candidature par e-mail).

---

## 4. AEDIA — Assistant IA (spécification détaillée)

### 4.1 Principes

AEDIA est un chatbot IA génératif public intégré à la plateforme (widget flottant + page `/ia` plein écran). Il répond sur l'organisation (identité, formations, événements…) **sans jamais exposer de données personnelles ou confidentielles**.

### 4.2 Pipeline (`src/modules/orizia/`)

1. **`POST /orizia/ask`** (SSE, `@Public()`, `OptionalJwtAuthGuard`) — envoi de la conversation + historique, réponse en streaming `Content-Type: text/event-stream`.
2. **`OriziaContextBuilder`** — contexte dynamique (contenu publié : actualités, programmes, ressources, événements, partenaires, équipe, à-propos, site config), texte limité (500 car., total 24 000 car.), cache 60 s.
3. **`OriziaContextLoader`** — charge les fichiers de contexte métier (`context_ai/` : markdown, tableurs, docx ; `ORIZIA_CONTEXT_DIR` défaut `./context_ai`) au démarrage, re-vérification toutes les 30 s, suivi `loadedFiles/skippedFiles`.
4. **`web-search.tool`** — recherche web DuckDuckGo (gratuite, sans clé), timeout 8 s, max 10 résultats, décodage entités HTML.
5. **`db-search.tool`** — recherche dans les collections **publiques uniquement** (news, programs, resources, events, partners, team, about, site) — exclusion explicite des prospects/candidatures/admins.
6. **`OriziaService`** — orchestration : 10 messages de contexte par défaut, historique max 50, recherche web plafonnée par fenêtre glissante, sélection du modèle OpenRouter.

### 4.3 Modèles & paramètres

- **Fournisseur** : OpenRouter (`https://openrouter.ai/api/v1`), jusqu'à 5 modèles (`ORIZIA_MODELS`, surchargeables), variantes `:free` (coût zéro, contexte 262k+, température/outils/raisonnement).
- **Paramètres** : température (défaut 0.7), niveau de raisonnement (`reasoningLevel`), clé API chiffrée en base (`openRouterApiKey`), configuration via `/orizia/settings` (admin).
- **Prompt système** (`system.prompt.ts`) : identité « AEDIA, l'intelligence artificielle des sommets », blocs de contexte (institutionnel, dynamique, routes), deux outils (`recherche_web`, `recherche_base`).
- **Contenu métier** dans `context_ai/` (ex. `00_identite_orizia.md`, `10_universite_des_montagnes.md`) : **éditable en production sans redéploiement**.
- **Confidentialité** : le module n'enregistre que des modèles publics (commentaire explicite dans `orizia.module.ts`).
- **Conversations** : historique persistant par visiteur (`GET /orizia/visitor/:visitorId`, identifiant `udm-…` généré côté front), accès admin aux conversations (`/orizia/conversations`, `/orizia/conversation/:id`).

---

## 5. Spécification technique — Frontend (seed_frontend)

### 5.1 Stack

Angular 17.3 (composants standalone, lazy loading), Bootstrap 5.3.8, FontAwesome 7.3.1, ApexCharts (graphiques du dashboard), RxJS 7.8, TypeScript. Build multi-environnements via `fileReplacements` (`angular.json`), budgets 1.5 / 3 Mo.

### 5.2 Architecture & routing (`src/app/app.routes.ts`)

- Routes **publiques** lazy sous `PublicLayoutComponent` : home, actualités (liste/détail), programmes (liste/détail public), événements (liste/détail), partenaires, équipe, ressources, contact + dons, mentions légales / politique de confidentialité, recrutements (liste/détail/candidature), **`/ia`** (protégée par `OriziaEnabledGuard`), wildcard `**` → 404.
- Routes **admin** lazy sous `AdminLayoutComponent`, protégées par `AuthGuard` + `RoleGuard` ; `/admin/login` protégée par `PublicOnlyGuard`.
- **Guards** : `auth.guard` (redirection `/admin/login?redirect=`), `role.guard` (lecture de `data.roles`, défaut `ADMIN_ROLES`, refus → `/admin/news`), `public-only`, `orizia-enabled` (blocage `/ia` quand AEDIA désactivé).

### 5.3 Layout public (`src/app/layouts/public-layout`)

- **Preloader** : logo + anneau de chargement + « Chargement… », z-index 99999.
- **Header** (242 lignes TS) : liens de navigation calculés à partir des `segments` activés dans la config, menu survol (`hoverMenu`, max 4 items), navigation programmatique compatible iOS, scroll vers le haut sur navigation « même page », détection des liens externes.
- **Footer** : liens rapides + liens sociaux filtrés par config, année courante.
- **Widget AEDIA** (334 lignes TS) : bouton flottant + drawer, écran de bienvenue (étoiles), suggestions, streaming SSE, historique à scroll infini vers le haut (seuil 80 px, scroll restauré), bascule vers la **page `/ia`** plein écran.
- Fond en grille 60 px.

### 5.4 Page d'accueil (`src/app/features/home`)

- Hero avec slides (rotation 8 s), chiffres clés (fallbacks 50+ / 300+ / 30+), section À-propos (animation reveal, SVG, vision/mission), bandeau texte rotatif (5 s), fonctionnalités, programmes / impacts (fallback `hasImpacts()`), carrousels événements / actualités, recrutements (3 derniers), vidéo de présentation (iframe si nettoyée), newsletter (service prospects, validations), marquee des partenaires (pause au survol), bouton retour en haut, squelettes de chargement, respect de `prefers-reduced-motion` / `pointer: fine`, parallax / effet luminosité au curseur.

### 5.5 Pages publiques

| Page | Fonctionnalités |
|---|---|
| **Actualités** | Liste avec recherche (debounce) + pagination (9/ page), détail en paragraphes avec tags et lead |
| **Programmes** | Impacts + programmes + CTA ; détail avec hero image, contenu sanitized, partage/copie de lien, domaine, contact |
| **Événements** | Liste + détail : statuts (à venir / en cours / terminés), programme horaire, panélistes, bloc d'informations / contact / réseaux sociaux, CTA final |
| **Partenaires** | Grille (4 colonnes) + CTA |
| **Équipe** | Sections et membres groupés, cartes cliquables, réseaux sociaux, marquee |
| **Ressources** | Filtres par catégories, pagination (12/ page), téléchargement |
| **Contact** | Formulaire réactif avec indicatifs téléphoniques, section Don si segment activé (composant partagé) |
| **Recrutement** | Liste paginée, détail HTML, **candidature** : champs dynamiques `formFields` (input/textarea/file), upload avec tailles max, états |
| **Légal** | Mentions légales + politique de confidentialité |

### 5.6 Back-office (`src/app/features/admin` + `layouts/admin-layout`)

Panneau d'administration complet : login (Google + mot de passe + 2FA), mot de passe oublié / réinitialisation, profil.

| Écran | Fonctionnalités |
|---|---|
| **Dashboard** | Statistiques clés + graphiques ApexCharts |
| **Tracking** | Analyse du trafic (séries, pages vues) |
| **News** (+ catégories) | Liste/recherche, formulaire (contenu enrichi, image WebP, tags, planification publication), détail, catégories |
| **Ressources** | CRUD avec catégorie, fichier/image, publication |
| **Programmes** | CRUD ordonnable, image, contenu |
| **Partenaires** | CRUD avec logo/webp, ordre |
| **Bannière** | Éditeur de slides + figures du carrousel |
| **À propos** | Contenu institutionnel + pays couverts |
| **Équipe** | Sections + membres (photos, réseaux sociaux) |
| **Messages** | Boîte de réception contact (lecture, suppression) |
| **Utilisateurs** | CRUD + détail (verrouillage, motifs, journal) |
| **Paramètres e-mail** | Configuration SMTP chiffrée |
| **Audit logs** | Journal d'activité avec filtres |
| **AEDIA** | Paramètres : activé/visible, logo, image de bienvenue, clé OpenRouter, température, niveau de raisonnement, conversations |
| **Prospects** | Liste + création |
| **Annonces** | Campagnes e-mailing (contenu, destinataires, planification, pièces jointes) |
| **Dons** | Modes de don / règlement |
| **Landing sections** | Éditeur de sections par segment (composant partagé `landing-section-editor`, visibilité par segment) |
| **Recrutements** | Campagnes + candidatures (champs dynamiques, fichiers, opérations/refus) |

**Matrice des rôles (vérifiée)** :
- `CONTENT_ROLES` (user, consultant, admin, superadmin) : news/, resources/, programs/, events/, recruitments/ (lecture + détails sans création).
- `data.roles = ADMIN_ROLES` : pages de création/édition (`news/new`, `news/:id/edit`, …).
- Défaut `ADMIN_ROLES` (aucun `data.roles` défini) : dashboard, tracking, partners, banner, about, team, messages, users, email, audit-logs, orizia, prospects, announcements, donations.
- `profile` : tout rôle authentifié (`roles: ['*']`).

### 5.7 Services, guards, intercepteurs (couche cœur `src/app/core`)

- **`api-gateway`** : client HTTP unique (`withCredentials`, `no-cache`).
- **`site-config`** : signaux `config` / `initialLoaded`, **rechargement à chaque navigation et au retour sur l'onglet** (corrigé récemment), fallback 2,5 s, gestion meta/theme.
- **`auth`** : `ensureSession`, cookie HttpOnly.
- **`orizia`** : lecture SSE (`OriziaChunk`), identifiant visiteur `udm-…`.
- **`stats`** : cookie `seed_visitor_id`, envoi visites/pageviews.
- **`toast`** : notifications (durées 3,5–6 s, fade 320 ms).
- **Intercepteur d'erreurs** : 401 (hors endpoint auth → logout + redirection login), mapping 400/401/403/404/409.
- **Pipes** : `markdown.pipe` (mini-renderer Markdown sans dépendance).
- **Utilitaires** : `video-embed` (whitelist YouTube/Facebook), validateurs (e-mail, E.164).
- ~24 services de données (news, programs, events, partners, team, resources, contact, banner, about, impacts, features-section, countries-section, video-highlight, prospects, recruitments, donations, announcements, news-category, upload, mail, admin-orizia-settings…).

### 5.8 Thème & identité visuelle

- SCSS thématisé : variables CSS (`--color-primary: #0bcc9c`, …), `brand-dynamic` (présélections `[part='preset-1']`), `style-preset`, dossiers `settings/`, `themes/`, `fonts/` (Berry, Phosphor, Tabler).
- **Multi-marques** : trois `index.html` (`index.html` ASFH, `index_seeds.html`, `index_asfh.html`) avec branding, favicons, `theme-color` (#48cfad / #04a2e8), titre mobile `digiKUNTZ`/selon marque.

### 5.9 Environnements de build

| Environnement | apiUrl | siteUrl | GoogleClientId | Usage |
|---|---|---|---|---|
| `environment.ts` | `http://localhost:3000/api` | `http://localhost:4200` | 569864… | Développement local |
| `environment.production.ts` | `https://backend.asfh.cm/api` | `https://asfh.cm` | 746500… | Prod ASFH |
| `env_seeds.ts` | `https://seeds-backend.yaba-in.com/api` | `https://seeds.yaba-in.com` | 569864… | Prod SEED |
| `env_asfh.ts` | `https://backend.asfh.cm/api` | `https://asfh.cm` | 746500… | Prod ASFH |

`environment.ts` / `environment.production.ts` embarquent aussi la configuration AEDIA (`orizia.enabled`, `contextRoute: '/context_ai'`, `suggestions`).

---

## 6. Variables d'environnement importantes (backend)

`MONGODB_URI`, `MONGODB_DB` (défaut `seed`), `JWT_SECRET`/`JWT_*`, `PORT` (défaut 3000), `CLIENT_ORIGIN`, `PUBLIC_URL`, `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_PASSWORD`/`SMTP_PORT`/`SMTP_SECURE`, `CONTACT_RECIPIENT_EMAIL`, `ORIZIA_CONTEXT_DIR` (défaut `./context_ai`), `ORIZIA_MODELS`, `SEED_DISABLED`, `API_PREFIX` (défaut `api`), `GOOGLE_*`.

---

## 7. Fonctionnalités — vue d'ensemble (synthèse métier)

1. **Site vitrine institutionnel** : hero carrousel, bannière rotative, statistiques, à-propos (vision/mission), fonctionnalités, impacts, actualités, programmes, événements, partenaires, équipe, ressources téléchargeables, vidéo de présentation, newsletter.
2. **Contact & conversion** : formulaire de contact (notification e-mail + confirmations), dons (segments), candidatures à des campagnes de recrutement à champs dynamiques.
3. **Back-office complet** : gestion de ~28 types de contenus, bannière, équipe/sections, utilisateurs et rôles, prospects, messages, e-mailing (annonces planifiées), dons, recrutements, landing sections par segment.
4. **Assistant IA AEDIA** : widget flottant + page plein écran, streaming, historique multi-sessions, outils de recherche web + documentaire, contexte métier éditable (fichiers + contenu publié), paramétrage admin (activation/visibilité/modèle), télémesures anti-hallucination.
5. **Observabilité & sécurité** : journal d'audit, statistiques de visites, 2FA, verrouillage de comptes, cookies HttpOnly, chiffrement des secrets, rate limiting global, validation des entrées.

---

## 8. État actuel & points d'attention

- **AEDIA multi-cibles** : le contenu de contexte à jour concerne l'UDM (`context_ai`), la plateforme cible actuelle.
- **Déploiement** : plusieurs variantes (SEED sur `seeds.yaba-in.com`, ASFH sur `asfh.cm`, UDM en préparation avec `seeds-backend.yaba-in.com` comme API). La sélection de variante se fait au build (`fileReplacements` + `index.html`).
- **Rappel opérationnel** : toute modification front doit être **rebuildée et redéployée** pour être visible en production.