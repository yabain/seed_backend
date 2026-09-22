# Répertoire de contexte d'AEDIA

Ce répertoire contient **les sources de vérité** d'Orizia. Tout ce qui s'y trouve est
injecté dans son contexte à chaque question : c'est ce qui limite drastiquement les
hallucinations.

> Le chemin de ce répertoire est configurable : voir la variable d'environnement
> `ORIZIA_CONTEXT_DIR` (par défaut `./context_udm`) dans le fichier `.env` du backend.

## Fichiers fournis

| Fichier | Rôle |
|---|---|
| `00_identite_orizia.md` | Identité, périmètre (UdM uniquement), règles de confidentialité et règles anti-hallucination. **Modifiable** : c'est le « prompt système ». |
| `10_universite_des_montagnes.md` | Base de connaissances sur l'UdM. **À compléter par l'administration** (voir les `TODO`). |

## Ajouter vos propres documents publics

Déposez simplement vos fichiers dans ce répertoire : ils sont chargés automatiquement au
démarrage du backend, **aucun code à modifier**.

### Formats pris en charge
| Format | Extensions | Remarque |
|---|---|---|
| Texte / Markdown | `.md` `.markdown` `.txt` | Recommandé — le plus fiable et le plus léger |
| Données tabulaires | `.csv` | Recommandé pour les tableaux de filières, tarifs, calendriers |
| JSON | `.json` | Pour des données structurées |
| Excel | `.xlsx` `.xls` | Lu (toutes les feuilles) et converti en texte |
| Word | `.docx` | Texte extrait automatiquement |

### Formats **non** pris en charge
| Format | Alternative |
|---|---|
| `.pdf` | Convertissez en `.docx`, `.md` ou `.txt` (l'extraction PDF fiable exige une dépendance supplémentaire) |
| `.doc` (ancien Word) | Enregistrez sous `.docx` |
| Images (`.png`, `.jpg`) | Le texte n'est pas reconnu (pas d'OCR) |

Un avertissement est écrit dans les logs du backend pour chaque fichier ignoré, avec la
liste des extensions supportées.

## Bonnes pratiques (importance de la qualité du contexte)

1. **Un sujet par fichier** : par exemple `20_filieres_et_formations.md`,
   `21_admissions_et_inscriptions.md`, `22_frais_de_scolarite.csv`,
   `23_calendrier_academique.csv`, `24_vie_du_campus.md`.
2. **Préférez le préfixe numérique** pour maîtriser l'ordre de lecture des fichiers.
3. **Écrivez des faits explicites**, pas des slogans : Orizia ne peut citer que ce qui est
   écrit noir sur blanc.
4. **Indiquez les dates de validité** dans les documents (Orizia ne doit pas présenter un
   tarif périmé comme actuel).
5. **N'incluez AUCUNE donnée personnelle** (listes de candidats, e-mails, téléphones
   privés, bulletins de notes, dossiers d'inscription) : ces fichiers seraient injectés
   dans le contexte du modèle d'IA. Ce répertoire est réservé aux **données publiques**.
6. Après tout ajout, modification ou suppression, le contexte est **rechargé
   automatiquement en moins de 30 secondes** (aucun redémarrage nécessaire) : posez une
   question à Orizia pour déclencher le rechargement. Vérifiez les logs du backend :
   `Contexte Orizia : N document(s), X caractères` est réaffiché à chaque rechargement.
