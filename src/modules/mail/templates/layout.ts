/**
 * Gabarit HTML commun aux e-mails SEED (en-tête, police, pied de page).
 */
export function renderEmailLayout(options: {
  title: string;
  preheader?: string;
  contentHtml: string;
  footerText?: string;
}): string {
  const { title, preheader = '', contentHtml, footerText } = options;
  const year = new Date().getFullYear();

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
              <td style="background:#0f172a;padding:20px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;background:#0f766e;color:#ffffff;border-radius:10px;font-size:20px;font-weight:bold;margin-right:10px;vertical-align:middle;">S</span>
                      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.5px;vertical-align:middle;">SEED</span>
                      <span style="color:#94a3b8;font-size:12px;vertical-align:middle;margin-left:8px;">Yaba-In SARL</span>
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
              <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;">
                  ${escapeHtml(footerText ?? `© ${year} SEED — Yaba-In SARL. Tous droits réservés.`)}
                </p>
                <p style="margin:0;color:#94a3b8;font-size:11px;">
                  Cet e-mail a été envoyé automatiquement par la plateforme SEED. Merci de ne pas y répondre directement.</p>
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
