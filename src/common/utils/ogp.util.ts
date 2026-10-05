import { ConfigService } from '@nestjs/config';

export { resolveOgpFrontendBase } from './frontend-url.util';

/**
 * Utilitaires de génération de pages HTML statiques Open Graph (OGP)
 * destinées aux robots sociaux (WhatsApp, Facebook, Twitter, LinkedIn).
 * Servies de façon dynamique par le backend, elles présentent le titre, le
 * résumé et l'image des contenus partageables.
 */

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(value: string): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toSnippet(value: string, max = 200): string {
  const text = stripHtml(value);
  return text.length > max ? `${text.slice(0, max - 3).trim()}…` : text;
}

/** Résout une image (absolue ou relative `/uploads/...`) en URL absolue. */
export function normalizeMediaUrl(
  image: string | undefined | null,
  mediaOrigin: string,
): string {
  const value = String(image || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const origin = mediaOrigin.replace(/\/+$/, '');
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

/** URL racine du front-office (pour og:url / canonical). */
export function buildFrontendUrl(configService: ConfigService): string {
  const explicit = configService.get<string>('FRONTEND_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  const clientOrigin = configService
    .get<string>('CLIENT_ORIGIN')
    ?.split(',')[0]
    ?.trim();
  return (clientOrigin || 'http://localhost:4200').replace(/\/+$/, '');
}

export interface OgpPageOptions {
  title: string;
  description?: string | null;
  image?: string | null;
  url: string;
  favicon?: string | null;
}

export function renderOgpPage(opts: OgpPageOptions): string {
  const title = opts.title?.trim() || 'Contenu';
  const description = toSnippet(opts.description || '');
  const image = opts.image || '';
  const favicon = opts.favicon || '';
  const imageTags = image
    ? [
        `<meta property="og:image" content="${escapeHtml(image)}" />`,
        `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`,
        `<meta property="og:image:alt" content="${escapeHtml(title)}" />`,
      ].join('\n  ')
    : '';
  const twitterImage = image
    ? `\n  <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : '';
  const faviconTag = favicon
    ? `<link rel="icon" type="image/x-icon" href="${escapeHtml(favicon)}" />\n    `
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${faviconTag}<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(opts.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(opts.url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:locale" content="fr_FR" />
  ${imageTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />${twitterImage}
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f6f8fa;color:#1f2937;">
    <div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="display:block;width:100%;height:auto;" />` : ''}
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 20px;color:#4b5563;line-height:1.6;">${escapeHtml(description)}</p>
        <a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Voir la page</a>
      </div>
    </div>
  </body>
</html>
`;
}