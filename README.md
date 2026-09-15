# yFrontend — Backend · API REST

> **API REST** de la plateforme web institutionnelle **yFrontend**
> 
> Développée par **Yaba-In SARL**.

![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white&style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white&style=flat-square)
![Mongoose](https://img.shields.io/badge/Mongoose-8-880000?style=flat-square)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/Licence-Private%20/UNLICENSED-4B5563?style=flat-square)

---

## Ce que fait ce backend

Module central des applications web institutionnelles **SEED** et **ASFH**. Il fournit :

- **Une API sécurisée** — authentification JWT globale, gestion des rôles, rate-limiting.
- **Des contenus institutionnels** — actualités, programmes, impacts, ressources, partenaires, équipe, événements, annonces.
- **Un upload d'images optimisé** — conversion automatique en **WebP** et stockage persistant hors déploiement.
- **De l'e-mail** — SMTP chiffré en base, envoi des notifications, réinitialisation de mot de passe, prospects et dons.
- **Des statistiques** — visites, pages vues, tableaux de bord, pistes (prospects) exportables en Excel.
- **Un back-office complet** — gestion des comptes, audit-log, configuration du site, bannières, sections d'impact… 28 modules.

---

## Stack technique

| Technologie | Rôle |
| --- | --- |
| **NestJS 10** | Framework backend (architecture modulaire, DI) |
| **TypeScript 5.7** | Typage statique |
| **MongoDB Atlas** | Base de données NoSQL (cloud) |
| **Mongoose 8** | ODM / modélisation des données |
| **Passport-JWT + bcryptjs** | Authentification & hachage des mots de passe |
| **class-validator / class-transformer** | Validation des DTOs |
| **Nodemailer** | Envoi d'e-mails (SMTP) |
| **@nestjs/schedule** | Tâches planifiées (cron) |
| **@nestjs/throttler** | Rate-limiting (100 requêtes / min) |
| **xlsx** | Export Excel des prospects |

---

## Architecture

```
                  ┌──────────────────────────────────────────────┐
  Angular          │                 NestJS API                  │
  (SEED / ASFH)    │                                              │
      │            │  Request ──▶ Guards (JWT ▸ Rôles ▸ Throttle) │
      │   HTTPS    │                │                             │
      ├───────────▶│                ▼                             │
      │            │           Controllers / DTOs                 │
      │            │                │                             │
      │            │                ▼                             │
      │            │             Services ───▶ MongoDB Atlas      │
      │            │                │                             │
      │            │                ├─▶ Uploads (WebP persistant) │
      │            │                └─▶ Nodemailer (SMTP)         │
      └────────────│──────────────────────────────────────────────┘
```

- **Préfixe API** : `/api` (configurable via `API_PREFIX`).
- **Certification sans cache** : `Cache-Control: no-store` sur toutes les réponses API.
- **Uploads** : servis statiquement sur `/uploads/`.

---

## Sécurité

| Protection | Implémentation |
| --- | --- |
| Authentification | `JwtAuthGuard` **global** — les routes publiques sont marquées `@Public()` |
| Autorisation | `RolesGuard` global + décorateur `@Roles('admin', 'superadmin', …)` |
| Rate-limiting | `ThrottlerGuard` global — 100 requêtes / min / IP |
| Validation | `ValidationPipe` global (`whitelist`, transformation implicite) |
| Secrets | Clés JWT / SMTP via `.env` ; identifiants SMTP **chiffrés** en base (`CryptModule`) |
| Fichiers | Taille max. 5 Mo, mime `image/*` uniquement, converti en **WebP** |

---

## Démarrage rapide

### Pré-requis

- **Node.js 20+** & npm
- Un cluster **MongoDB Atlas** (base créée + IP autorisée)

### Installation & lancement

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier d'environnement
#    (modèle production SEEDS – un modèle ASFH existe aussi : env-prod-asfh)
cp env-prod-seeds .env

# 3. Renseigner les variables clés dans .env
#    MONGODB_URI / MONGODB_DB / JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD
#    (les identifiants SMTP et CRYPT_KEY sont facultatifs au premier lancement)

# 4. Lancer l'API en mode développement (rechargement automatique)
npm run start:dev
```

Au premier lancement, un **compte administrateur** (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
et des **données de démonstration** sont créés automatiquement.

L'API est disponible sur **http://localhost:3000/api** — santé : `GET /api/health`.

> ⚠️ **Ne commitez jamais votre `.env`** contenant les secrets de production.

---

## Variables d'environnement

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NODE_ENV` | non | `development` / `production` |
| `PORT` | non | Port HTTP (défaut `3000`) |
| `API_PREFIX` | non | Préfixe des routes (défaut `api`) |
| `CLIENT_ORIGIN` | non | Origines CORS séparées par des virgules |
| `MONGODB_URI` | **oui** | Chaîne de connexion MongoDB Atlas |
| `MONGODB_DB` | **oui** | Nom de la base (ex. `seed`, `asfh`) |
| `JWT_SECRET` | **oui** | Clé de signature des tokens |
| `JWT_EXPIRES_IN` | non | Durée de validité (défaut `7d`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | **oui** | Compte superadmin initial |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | non | SMTP pour l'envoi d'e-mails (vide = désactivé) |
| `CONTACT_RECIPIENT_EMAIL` | non | Destinataire de secours des notifications |
| `CRYPT_KEY` | non | Clé de chiffrement des identifiants SMTP |
| `PUBLIC_URL` | non | URL publique de l'API (e-mails, uploads) |
| `UPLOAD_DIR` | non | Répertoire uploads **persistant** (production) |
| `UPLOAD_DIR_LOCAL` | non | Répertoire uploads local (dev, défaut `uploads`) |
| `EMAIL_LOGO_URL` / `EMAIL_SOCIAL_*` | non | Personnalisation des e-mails |
| `GOOGLE_CLIENT_ID` | non | Login Google (si activé) |

---

## Structure du projet

```
seed_backend/
├── src/
│   ├── main.ts                     # Bootstrap : CORS, ValidationPipe, static /uploads
│   ├── app.module.ts               # Module racine (Config + MongoDB + 28 modules)
│   ├── app.controller.ts           # GET /api (info) + GET /api/health
│   ├── common/
│   │   ├── decorators/             # @Public(), @Roles(), @CurrentUser()
│   │   ├── guards/                 # JwtAuthGuard, RolesGuard
│   │   └── utils/                  # Gestion du dossier & suppression d'uploads
│   └── modules/
│       ├── auth/                   # Login, JWT, profils, mot de passe oublié
│       ├── news/ + news-category/  # Actualités & catégories
│       ├── programs/               # Programmes & domaines d'intervention
│       ├── impacts/                # Sections d'impact (métriques + images WebP)
│       ├── resources/              # Ressources téléchargeables
│       ├── partners/               # Partenaires
│       ├── events/                 # Événements
│       ├── announcements/          # Annonces (bandeau)
│       ├── team/                   # Membres & sections d'équipe
│       ├── banner/                 # Bannières & sections du site
│       ├── about/                  # Page « À propos »
│       ├── features-section/       # Sections de fonctionnalités
│       ├── countries-section/      # Sections par pays
│       ├── video-highlight-section # Section vidéo mise en avant
│       ├── donations/              # Dons
│       ├── prospects/              # Pistage prospects (export Excel)
│       ├── contact/                # Formulaires de contact + notifications
│       ├── stats/                  # Visites, pages vues, top pages
│       ├── site/                   # Configuration institutionnelle
│       ├── users/                  # Gestion des comptes (admin)
│       ├── audit-log/              # Journal d'audit
│       ├── upload/                 # Upload d'images → WebP
│       ├── mail/ + smtp/ + email/  # E-mails : templates, SMTP chiffré, préférences
│       ├── crypt/                  # Chiffrement des secrets
│       └── seed/                   # Données de démonstration automatiques
├── test/                           # Tests e2e
├── uploads/                        # Fichiers uploadés (dev)
├── env-prod-seeds                  # Modèle .env → production SEEDS
├── env-prod-asfh                   # Modèle .env → production ASFH
└── package.json
```

---

## Points d'entrée de l'API

### Système

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api` | 🔓 public | Informations de l'API |
| GET | `/api/health` | 🔓 public | Vérification de santé (`status`, `uptime`) |

### Espace public

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/news` · `/api/news/latest` · `/api/news/slug/:slug` | Actualités publiées |
| GET | `/api/resources` · `/api/resources/categories` | Ressources & catégories |
| GET | `/api/programs` | Programmes actifs |
| GET | `/api/impacts` | Sections d'impact actives |
| GET | `/api/partners` | Partenaires actifs |
| GET | `/api/events` | Événements |
| GET | `/api/team` | Membres de l'équipe |
| GET | `/api/banner` · `/api/about` · `/api/site-config` | Configurations publiques du site |
| GET | `/api/features-section` · `/api/countries-section` · `/api/video-highlight-section` | Sections du site |
| POST | `/api/contact` | Formulaire de contact |
| POST | `/api/prospects` | Devenir prospect / lead |
| POST | `/api/donations` | Effectuer un don |
| POST | `/api/stats/visit` | Enregistrer une visite / page vue |

### Authentification

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Connexion → JWT |
| POST | `/api/admin/auth/forgot-password` | Demande de réinitialisation |
| POST | `/api/admin/auth/reset-password` | Réinitialisation du mot de passe |
| GET/PATCH | `/api/admin/auth/profile` | Profil de l'utilisateur connecté |
| POST | `/api/admin/upload` | Upload d'image → conversion **WebP** |

### Back-office (JWT + rôles requis)

| Méthode | Route | Description |
| --- | --- | --- |
| CRUD | `/api/news` · `/api/news/:id` | Gestion des actualités |
| CRUD | `/api/news-categories` | Catégories d'actualités |
| CRUD | `/api/resources` · `/api/resources/:id` | Ressources |
| CRUD | `/api/programs` · `/api/programs/:id` | Programmes |
| CRUD | `/api/impacts` · `/api/impacts/:id` | Sections d'impact |
| CRUD | `/api/partners` · `/api/partners/:id` | Partenaires |
| CRUD | `/api/events` · `/api/events/:id` | Événements |
| CRUD | `/api/admin/announcements` | Annonces |
| CRUD | `/api/admin/users` | Comptes & rôles |
| CRUD | `/api/team` | Membres de l'équipe |
| GET/PATCH/DELETE | `/api/contact` · `/api/contact/:id` | Messages reçus |
| GET | `/api/prospects` · `/api/prospects/:id` | Gestion des prospects (export Excel) |
| GET | `/api/stats/summary` · `/api/stats/daily` · `/api/stats/top-pages` | Statistiques |
| GET | `/api/audit-logs` | Journal d'audit |
| GET/PATCH | `/api/email` · `/api/smtp` | Configuration e-mail / SMTP |
| PUT/PATCH | `/api/banner` · `/api/about` · `/api/site-config` · `*/feature*` | Configurations du site |

---

## Scripts utiles

```bash
npm run start       # Démarrage (sans watch)
npm run start:dev   # Développement avec rechargement automatique
npm run start:debug # Développement en mode debug
npm run start:prod  # Lance la version compilée (node dist/main)
npm run build       # Compilation TypeScript -> dist/
npm run lint        # ESLint (avec --fix)
npm run format      # Prettier
npm test            # Tests unitaires (Jest)
npm run test:cov    # Tests + couverture
npm run test:e2e    # Tests end-to-end
```

---

## Upload d'images — conversion WebP

- Endpoint : `POST /api/admin/upload` (`FileInterceptor` — champ `file`).
- **Conversion WebP côté client** : les images JPEG/PNG/WebP/SVG/GIF sont converties en **WebP** avant envoi (max. 5 Mo).
- Fichiers stockés dans un répertoire **persistant** (`UPLOAD_DIR` en production) et servis sur `/uploads/…`.
- L'option `oldPath` permet de **supprimer l'ancien fichier** lors d'un remplacement.
- La suppression d'une entité (impact, programme…) supprime également ses fichiers liés.

---

## Tests

```bash
npm test            # Tests unitaires
npm run test:cov    # Couverture
npm run test:e2e    # Tests end-to-end
```

---

## Licence

Projet **privé** — © **Yaba-In SARL**. Usage strictement réservé aux plateformes autorisées.