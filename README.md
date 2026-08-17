# SEED Backend — API REST (NestJS + MongoDB Atlas)

API REST de la plateforme web institutionnelle de l'organisation **SEED**, développée par **Yaba-In SARL**.

Stack : **NestJS 10** · **TypeScript** · **Mongoose** · **MongoDB Atlas** · **Passport-JWT** · **bcryptjs** · **Nodemailer**.

## Fonctionnalités

| Module          | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| **Auth**        | Connexion admin sécurisée (JWT + hash bcrypt), route protégée par AuthGuard. |
| **News**        | CRUD des actualités (brouillon / publié), pagination, recherche, slug.       |
| **Resources**   | CRUD des ressources téléchargeables (rapports, guides), filtre par catégorie.|
| **Programs**    | CRUD des programmes et domaines d'intervention de SEED.                     |
| **Partners**    | CRUD des partenaires (nom, logo, site web).                                 |
| **Contact**     | Formulaire de contact : sauvegarde en base + email via Nodemailer.          |
| **Stats**       | Compteur de visites uniques / pages vues (résumé + séries journalières).     |
| **Site Config** | Textes institutionnels fixes, coordonnées et réseaux sociaux.     |
| **Seed**        | Données de test injectées automatiquement au premier lancement.             |

## Pré-requis

- Node.js **20.x** (ou supérieur) et npm
- Un compte **MongoDB Atlas** avec une base de données créée (et l'IP autorisée)

## Installation & démarrage (local)

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier d'environnement
cp .env.example .env
#    Renseignez MONGODB_URI avec votre chaîne de connexion Atlas,
#    puis JWT_SECRET et vos identifiants SMTP (facultatif).

# 3. Lancer l'API en mode développement
npm run start:dev
```

À la première exécution, les données de démonstration sont insérées automatiquement
(compte admin, actualités, ressources, programmes, partenaires, configuration du site).


## Points d'entrée principaux

- `GET /api` — informations de l'API
- `GET /api/health` — vérification de santé

### Espace public (sans authentification)

| Méthode | Route                              | Description                                      |
| ------- | ----------------------------------- | ------------------------------------------------ |
| GET     | `/api/news`                         | Actualités publiées (paginées)                  |
| GET     | `/api/news/latest`                  | Dernières 3 actualités                          |
| GET     | `/api/news/slug/:slug`              | Détail d'une actualité par slug                 |
| GET     | `/api/resources`                    | Ressources publiées, filtre `?category=`        |
| GET     | `/api/resources/categories`         | Liste des catégories                            |
| GET     | `/api/programs`                     | Programmes actifs                               |
| GET     | `/api/partners`                     | Partenaires actifs                              |
| POST    | `/api/contact`                      | Envoi d'un message de contact                   |
| POST    | `/api/stats/visit`                  | Enregistre une visite / page vue                |
| GET     | `/api/site-config`                  | Configuration publique du site                  |

### Back-office (JWT requis — header `Authorization: Bearer <token>`)

| Méthode | Route                               | Description                                 |
| ------- | ------------------------------------| ------------------------------------------- |
| POST    | `/api/admin/auth/login`             | Connexion -> `{ accessToken, admin }`      |
| GET/POST/PATCH/DELETE | `/api/news[/:id]`      | Gestion complète des actualités            |
| GET/POST/PATCH/DELETE | `/api/resources[/:id]`  | Gestion complète des ressources            |
| GET/POST/PATCH/DELETE | `/api/programs[/:id]`   | Gestion complète des programmes            |
| GET/POST/PATCH/DELETE | `/api/partners[/:id]`   | Gestion complète des partenaires           |
| GET     | `/api/contact`                       | Liste des messages reçus                   |
| PATCH   | `/api/contact/:id/read`              | Marquer un message comme lu                |
| DELETE  | `/api/contact/:id`                   | Supprimer un message                       |
| GET     | `/api/stats/summary`                 | Résumé des statistiques                    |
| GET     | `/api/stats/daily?days=14`           | Série de fréquentation journalière         |
| GET     | `/api/stats/top-pages`               | Pages les plus visitées                    |
| PUT     | `/api/site-config`                   | Mise à jour de la configuration du site    |

## Structure du projet

```
src/
├── main.ts                        # Bootstrap (CORS, ValidationPipe, préfixe /api)
├── app.module.ts                  # Module racine (Config + MongoDB + modules)
├── common/
│   ├── decorators/                # @Public(), @CurrentUser()
│   └── guards/                    # JwtAuthGuard (global)
└── modules/
    ├── auth/                      # Connexion admin, JWT, stratégies
    ├── news/                      # Actualités
    ├── resources/                 # Ressources / PDF
    ├── programs/                  # Programmes & domaines
    ├── partners/                  # Partenaires
    ├── contact/                   # Formulaire de contact + emails
    ├── stats/                     # Statistiques de visites
    ├── site/                      # Configuration institutionnelle
    └── seed/                      # Données de test automatiques
```

## Scripts utiles

```bash
npm run start:dev     # Développement avec rechargement automatique
npm run build         # Compilation TypeScript -> dist/
npm run start:prod    # Lance la version compilée
npm run lint          # Vérification du code (ESLint)
npm test              # Tests unitaires (Jest)
```

## Remarque sur les fichiers (images / PDF / logos)

Pour ce prototype, les images et fichiers sont stockés sous forme de chaînes **base64**
(données Data URI) dans MongoDB Atlas. Dans le back-office, convertissez vos fichiers
via l'interface web avant enregistrement. En production, on pourra les remplacer par
un stockage objet cloud (S3 / Cloudinary) et servir les URLs correspondantes.