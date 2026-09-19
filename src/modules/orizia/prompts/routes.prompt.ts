/**
 * Routes publiques du site, fournies à Orizia pour qu'elle oriente l'utilisateur
 * avec des liens Markdown valides.
 *
 * Volontairement défini en TypeScript (et non dans un fichier `.txt` chargé à
 * l'exécution) : `nest build` ne copie pas les fichiers non-TypeScript dans
 * `dist`, si bien qu'un `.txt` lu depuis `__dirname` serait introuvable en
 * production.
 */
export const ORIZIA_ROUTES_RESOURCE = `# ROUTES PUBLIQUES DU SITE INSTITUTIONNEL

Toutes les routes sont relatives à l'URL de base du site (indiquée plus haut).
Utilise-les pour orienter l'utilisateur, au format Markdown : [libellé](URL complète).

- / — Page d'accueil : présentation générale, actualités et événements mis en avant.
- /news — Liste complète des actualités et annonces publiées.
- /news/{slug} — Détail d'une actualité.
- /programs — Programmes, projets et actions de l'institution.
- /programs/{id} — Détail d'un programme.
- /events — Liste des événements (à venir, en cours, passés).
- /events/{id} — Détail d'un événement (lieu, dates, contacts, inscription).
- /resources — Centre de ressources : documents, rapports, guides téléchargeables.
- /team — Présentation de l'équipe et de ses membres.
- /partners — Partenaires de l'institution.
- /contact — Formulaire de contact et coordonnées officielles.
- /mentions-legales — Mentions légales.
- /politique-confidentialite — Politique de confidentialité.

Notes à ton attention :
- N'invente jamais d'identifiant ({id}) ni de slug ({slug}) : ne construis un lien vers
  une page de détail que si l'identifiant figure explicitement dans ton contexte.
- Pour une demande d'information générale, privilégie les pages de liste.
- Pour une demande d'inscription, d'admission ou de scolarité, oriente vers /contact en
  citant les coordonnées officielles si elles figurent dans ton contexte.
- Pour toute demande d'information hors de tes sources, renvoie vers /contact.`;
