/**
 * Gabarit HTML commun aux e-mails de l’organisation (en-tête, police, pied de page).
 */

const DEFAULT_PRIMARY = '#0bcc9c';
const DEFAULT_SECONDARY = '#0f766e';

function normalizeHex(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

/** Mélange une couleur hexadécimale avec du blanc (ratio 0 = couleur, 1 = blanc). */
export function mixHexWithWhite(hex: string, ratio: number): string {
  const clean = normalizeHex(hex, DEFAULT_PRIMARY);
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

export function renderEmailLayout(options: {
  title: string;
  preheader?: string;
  contentHtml: string;
  footerText?: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  branding?: {
    logo?: string;
    orgName?: string;
    social?: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      twitter?: string;
      youtube?: string;
    };
  };
}): string {
  const { title, preheader = '', contentHtml, footerText, colors } = options;
  const primary = normalizeHex(colors?.primary, DEFAULT_PRIMARY);
  const secondary = normalizeHex(colors?.secondary, DEFAULT_SECONDARY);
  const year = new Date().getFullYear();
  const logo = options.branding?.logo?.trim();
  const orgName = escapeHtml(options.branding?.orgName?.trim() ?? 'Organisation');
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="${orgName}" style="display:inline-block;max-height:38px;max-width:160px;height:auto;vertical-align:middle;margin-right:10px;" />`
    : `<span style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;background:${primary};color:#ffffff;border-radius:10px;font-size:20px;font-weight:bold;margin-right:10px;vertical-align:middle;">${orgName.charAt(0)}</span>`;

  const social = options.branding?.social;
  let socialHtml = '';
  if (social) {
    const icons: { href: string; svg: string }[] = [];
    if (social.facebook) {
      icons.push({
        href: social.facebook,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>`,
      });
    }
    if (social.twitter) {
      icons.push({
        href: social.twitter,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      });
    }
    if (social.linkedin) {
      icons.push({
        href: social.linkedin,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
      });
    }
    if (social.instagram) {
      icons.push({
        href: social.instagram,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`,
      });
    }
    if (social.youtube) {
      icons.push({
        href: social.youtube,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      });
    }
    if (icons.length) {
      socialHtml = `<table cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>${icons.map(icon => `<td style="padding:0 6px;"><a href="${escapeHtml(icon.href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">${icon.svg}</a></td>`).join('')}</tr></table>`;
    }
  }

  return `
  <!doctype html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(preheader)}</div>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08);">
            <!-- En-tête -->
            <tr>
              <td style="background:none;padding:20px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      ${logoHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Titre -->
            <tr>
              <td style="padding:28px 28px 8px;">
                <h1 style="margin:0;font-size:20px;color:#0f172a;line-height:1.3;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <!-- Corps -->
            <tr>
              <td style="padding:12px 28px 24px;color:#334155;font-size:15px;line-height:1.7;">
                ${contentHtml}
              </td>
            </tr>
            <!-- Pied de page -->
            <tr>
              <td style="background:${mixHexWithWhite(secondary, 0.92)};padding:18px 28px;border-top:3px solid ${secondary};">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;">
                  ${escapeHtml(footerText ?? `© ${year} ${orgName}. Tous droits réservés.`)}
                </p>
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  Cet e-mail a été envoyé automatiquement par la plateforme ${orgName}. Merci de ne pas y répondre directement.</p>
                ${socialHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/** Échappe les caractères HTML sensibles d'une chaîne utilisateur. */
export function escapeHtml(input: string | undefined | null): string {
  return (input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Met en forme une ligne "libellé / valeur" dans le corps de l'e-mail. */
export function renderEmailField(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 0;color:#64748b;font-size:13px;white-space:nowrap;width:140px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#0f172a;font-weight:600;">${escapeHtml(value) || '<em style="color:#94a3b8">—</em>'}</td>
    </tr>`;
}
