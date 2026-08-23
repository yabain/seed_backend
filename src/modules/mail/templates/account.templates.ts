import {
  renderEmailLayout,
  escapeHtml,
  renderEmailField,
  mixHexWithWhite,
} from './layout';

export interface AccountBranding {
  logo?: string;
  orgName?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
  };
}

export interface AccountCredentialsTemplateOptions {
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  loginUrl: string;
  siteLink?: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  branding?: AccountBranding;
}

export function accountCredentialsTemplate(
  options: AccountCredentialsTemplateOptions,
): string {
  const {
    name,
    email,
    password,
    roleLabel,
    loginUrl,
    siteLink,
    colors,
    branding,
  } = options;
  const orgName = branding?.orgName?.trim() || 'SEED';
  const primary = mixHexWithWhite(colors?.primary ?? '', 0);
  const primarySoft = mixHexWithWhite(colors?.primary ?? '', 0.25);

  const contentHtml = `
    <p style="margin:0 0 16px;color:#0f172a;">Bonjour <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin:0 0 20px;color:#334155;line-height:1.6;">
      Un compte ${escapeHtml(orgName)} vient d'être créé pour vous. Vous pouvez dès
      maintenant vous connecter à l'espace d'administration avec les identifiants
      ci-dessous&nbsp;:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;padding:14px 18px;margin:0 0 22px;">
      ${renderEmailField('Type de compte', roleLabel)}
      ${renderEmailField('E-mail', email)}
      ${renderEmailField('Mot de passe', password)}
    </table>
    <p style="margin:0 0 20px;color:#334155;line-height:1.6;">
      Pour des raisons de sécurité, nous vous recommandons de modifier ce mot de
      passe après votre première connexion.
    </p>
    <a href="${escapeHtml(loginUrl)}"
       style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:50rem;">
      Se connecter
    </a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br />
      <span style="color:${primarySoft};">${escapeHtml(loginUrl)}</span>
    </p>${
      siteLink
        ? `<p style="margin:14px 0 0;color:#334155;font-size:13px;line-height:1.6;">
      Découvrez notre site&nbsp;: <a href="${escapeHtml(siteLink)}" style="color:${primarySoft};font-weight:600;text-decoration:none;">${escapeHtml(siteLink.replace(/^https?:\/\//i, ''))}</a>
    </p>`
        : ''
    }`;

  return renderEmailLayout({
    title: `Votre compte ${orgName}`,
    preheader: 'Vos identifiants de connexion à l’espace d’administration.',
    contentHtml,
    footerText: `Cet e-mail a été envoyé automatiquement suite à la création de votre compte ${orgName}.`,
    colors,
    branding,
  });
}
