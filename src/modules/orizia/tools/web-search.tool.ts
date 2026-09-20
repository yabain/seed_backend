/**
 * Outil « recherche_web » d'Orizia.
 *
 * Recherche sur Internet via DuckDuckGo Lite (endpoint HTML gratuit, **sans clé
 * d'API**). Le balisage renvoyé par cet endpoint étant minimal et peu standard,
 * les résultats sont extraits par correspondance de motifs plutôt que par un
 * parseur HTML complet (aucune dépendance supplémentaire).
 *
 * Le volume est plafonné côté `OriziaService` (fenêtre glissante à la minute) :
 * ce fichier ne fait que le transport et l'extraction.
 */

const DUCKDUCKGO_LITE_URL = 'https://lite.duckduckgo.com/lite/';
const SEARCH_TIMEOUT_MS = 8_000;
const MAX_RESULTS_HARD_CAP = 10;

export interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
}

interface RawResultBlock {
  link?: string;
  title?: string;
  snippet?: string;
}

/** Décodage des entités HTML courantes. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'");
}

/** Nettole un extrait texte : entités, balises résiduelles et espaces superflus. */
function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrait l'attribut `href` d'un lien DuckDuckGo (relatif ou absolu). */
function toAbsoluteUrl(href: string): string {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://duckduckgo.com${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/** Découpe la page en blocs de résultat, chacun contenant un lien + un extrait. */
function parseResults(html: string): RawResultBlock[] {
  const blocks: RawResultBlock[] = [];
  // La page Lite enveloppe chaque résultat dans <div class='result'>.
  const parts = html.split(/<div\s+class=['"]result['"]\s*>/i);
  for (const part of parts.slice(1)) {
    const block: RawResultBlock = {};

    const linkMatch =
      /<a[^>]*class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i.exec(
        part,
      );
    if (linkMatch) {
      block.link = toAbsoluteUrl(linkMatch[1]);
      block.title = cleanText(linkMatch[2]).slice(0, 220);
    }

    const snippetMatch =
      /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i.exec(part);
    if (snippetMatch) {
      block.snippet = cleanText(snippetMatch[1]).slice(0, 500);
    }

    if (block.link) blocks.push(block);
  }
  return blocks;
}

/**
 * Lance une recherche et retourne les premiers résultats utiles.
 *
 * Lève une erreur en cas d'échec réseau ou de réponse inattendue — jamais de
 * résultat inventé par escamotage de l'erreur.
 */
export async function searchWeb(
  query: string,
  maxResults = 5,
): Promise<WebSearchItem[]> {
  const limit = Math.min(
    Math.max(1, Math.floor(maxResults)),
    MAX_RESULTS_HARD_CAP,
  );
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${DUCKDUCKGO_LITE_URL}?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          Accept: 'text/html',
        },
        signal: abort.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Recherche web : réponse HTTP ${response.status}`);
    }

    const html = await response.text();
    const results: WebSearchItem[] = parseResults(html)
      .filter(
        (block) =>
          block.title &&
          block.link &&
          !/duckduckgo\.com\/\?q=/i.test(block.link),
      )
      .slice(0, limit)
      .map((block) => ({
        title: block.title ?? '',
        url: block.link ?? '',
        snippet: block.snippet ?? '',
      }));

    if (!results.length) {
      // L'endpoint affiche régulièrement un paquetage « anomalies » : on le
      // signale pour que le modèle réponde honnêtement plutôt que d'improviser.
      if (/anomaly|auf nicht/i.test(html)) {
        throw new Error(
          'Recherche web : réponse temporairement bloquée (contrôle anti-robot).',
        );
      }
    }
    return results;
  } finally {
    clearTimeout(timer);
  }
}
