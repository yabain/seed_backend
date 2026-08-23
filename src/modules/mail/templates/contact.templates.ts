import { renderEmailLayout, escapeHtml, renderEmailField } from './layout';

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt?: Date;
}

export interface ContactTemplateOptions {
  payload: ContactPayload;
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
}

/**
 * E-mail de notification envoyé aux administrateurs lorsqu'un
 * visiteur soumet le formulaire de contact.
 */
export function contactNotificationTemplate(options: ContactTemplateOptions): string {
  const { payload, branding, colors } = options;
  const receivedAt = (payload.createdAt ?? new Date()).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const details = [
    renderEmailField('Nom', payload.name),
    renderEmailField('E-mail', payload.email),
    renderEmailField('Téléphone', payload.phone ?? ''),
    renderEmailField('Sujet', payload.subject),
    renderEmailField('Reçu le', receivedAt),
  ].join('');

  const contentHtml = `
    <p style="margin:0 0 16px;">Un nouveau message vient d'&ecirc;tre envoy&eacute; depuis le formulaire de contact du site.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">${details}</table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="padding:0 0 4px;color:#475569;font-size:13px;"><strong>Message :</strong></td>
      </tr>
      <tr>
        <td style="padding:0;border-left:3px solid #0f766e;padding-left:12px;color:#334155;">
          ${escapeHtml(payload.message).replace(/\n/g, '<br/>')}
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0;color:#94a3b8;font-size:13px;">
      R&eacute;pondez au visiteur depuis sa bo&icirc;te e-mail ou via l'espace administrateur du site.
    </p>
  `;

  return renderEmailLayout({
    title: `Nouveau message de contact — ${payload.subject}`,
    preheader: `${payload.name} (${payload.email}) a envoyé un message sur le site SEED.`,
    contentHtml,
    colors,
    branding,
  });
}

/**
 * E-mail de confirmation automatiquement envoyé au visiteur qui vient
 * de soumettre le formulaire de contact.
 */
export function contactConfirmationTemplate(options: ContactTemplateOptions): string {
  const { payload, branding, colors } = options;
  const recap = [
    renderEmailField('Nom', payload.name),
    renderEmailField('E-mail', payload.email),
    renderEmailField('Téléphone', payload.phone ?? ''),
    renderEmailField('Sujet', payload.subject),
  ].join('');

  const contentHtml = `
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(payload.name)}</strong>,</p>
    <p style="margin:0 0 16px;">
      Nous vous remercions de nous avoir &eacute;crit. Votre message a bien &eacute;t&eacute;
      re&ccedil;u par notre &eacute;quipe et nous reviendrons vers vous dans les plus brefs d&eacute;lais.
    </p>
    <p style="margin:0 0 16px;">Voici un r&eacute;captulatif de votre demande :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">${recap}</table>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#334155;">
      En attendant, n'h&eacute;sitez pas &agrave; poursuivre votre navigation sur
      <a href="#" style="color:#0f766e;font-weight:600;">notre plateforme</a> pour d&eacute;couvrir nos actions.
    </p>
    <p style="margin:6px 0 0;color:#64748b;">L'&eacute;quipe SEEDS vous remercie.</p>
  `;

  return renderEmailLayout({
    title: 'Nous avons bien reçu votre message',
    preheader: `Merci ${payload.name}, votre message a bien été enregistré.`,
    contentHtml,
    footerText: `© ${new Date().getFullYear()} SEEDS. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    branding,
  });
}
