import {
  escapeHtml,
  renderEmailField,
  renderEmailLayout,
} from './layout';

interface RecruitmentBranding {
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

interface RecruitmentColors {
  primary?: string;
  secondary?: string;
}

interface RecruitmentApplicant {
  firstName: string;
  lastName: string;
  email: string;
}

interface RecruitmentTemplateBase {
  campaignTitle: string;
  applicant: RecruitmentApplicant;
  fields: Array<{ label: string; value: string }>;
  colors?: RecruitmentColors;
  branding?: RecruitmentBranding;
}

export function recruitmentApplicationReceivedForApplicantTemplate(
  options: RecruitmentTemplateBase,
): string {
  const { campaignTitle, applicant, fields, colors, branding } = options;
  const recap = fields
    .map((entry) => renderEmailField(entry.label, entry.value))
    .join('');

  const contentHtml = `
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(applicant.firstName)} ${escapeHtml(applicant.lastName)}</strong>,</p>
    <p style="margin:0 0 16px;">
      Votre candidature pour la campagne <strong>${escapeHtml(campaignTitle)}</strong>
      a bien été reçue. Notre équipe l'examinera dans les meilleurs délais.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${recap}
        </table>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#64748b;">
      Merci pour votre intérêt. Vous recevrez une notification dès qu'une décision
      sera prise sur votre dossier.
    </p>
  `;

  return renderEmailLayout({
    title: 'Candidature reçue',
    preheader: `Votre candidature pour ${campaignTitle} a été enregistrée.`,
    contentHtml,
    colors,
    branding,
  });
}

export function recruitmentApplicationReceivedForAdminTemplate(
  options: RecruitmentTemplateBase,
): string {
  const { campaignTitle, applicant, fields, colors, branding } = options;
  const recap = fields
    .map((entry) => renderEmailField(entry.label, entry.value))
    .join('');

  const contentHtml = `
    <p style="margin:0 0 16px;">
      Une nouvelle candidature a été reçue pour la campagne
      <strong>${escapeHtml(campaignTitle)}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${renderEmailField('Nom', `${applicant.firstName} ${applicant.lastName}`)}
          ${renderEmailField('E-mail', applicant.email)}
          ${recap}
        </table>
      </td></tr>
    </table>
  `;

  return renderEmailLayout({
    title: `Nouvelle candidature — ${campaignTitle}`,
    preheader: `${applicant.firstName} ${applicant.lastName} a soumis une candidature.`,
    contentHtml,
    colors,
    branding,
  });
}

export function recruitmentApplicationApprovedTemplate(options: {
  campaignTitle: string;
  applicant: RecruitmentApplicant;
  colors?: RecruitmentColors;
  branding?: RecruitmentBranding;
}): string {
  const { campaignTitle, applicant, colors, branding } = options;
  const contentHtml = `
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(applicant.firstName)} ${escapeHtml(applicant.lastName)}</strong>,</p>
    <p style="margin:0 0 16px;">
      Bonne nouvelle&nbsp;! Votre candidature pour la campagne
      <strong>${escapeHtml(campaignTitle)}</strong> a été <strong>approuvée</strong>.
    </p>
    <p style="margin:0;color:#334155;">
      Vous passerez à la seconde étape du processus de recrutement. Notre équipe
      vous contactera bientôt avec les prochaines instructions.
    </p>
  `;

  return renderEmailLayout({
    title: 'Candidature approuvée',
    preheader: `Votre candidature pour ${campaignTitle} est approuvée.`,
    contentHtml,
    colors,
    branding,
  });
}

export function recruitmentApplicationRejectedTemplate(options: {
  campaignTitle: string;
  applicant: RecruitmentApplicant;
  colors?: RecruitmentColors;
  branding?: RecruitmentBranding;
}): string {
  const { campaignTitle, applicant, colors, branding } = options;
  const contentHtml = `
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(applicant.firstName)} ${escapeHtml(applicant.lastName)}</strong>,</p>
    <p style="margin:0 0 16px;">
      Nous vous remercions pour votre candidature à la campagne
      <strong>${escapeHtml(campaignTitle)}</strong>.
    </p>
    <p style="margin:0;color:#334155;">
      Après étude de votre dossier, nous sommes au regret de vous informer que
      votre candidature n'a pas été retenue pour cette phase.
    </p>
  `;

  return renderEmailLayout({
    title: 'Mise à jour de votre candidature',
    preheader: `Votre candidature pour ${campaignTitle} n'a pas été retenue.`,
    contentHtml,
    colors,
    branding,
  });
}
