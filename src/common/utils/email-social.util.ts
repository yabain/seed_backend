import { ConfigService } from '@nestjs/config';

export interface EmailSocial {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
}

/**
 * Retourne les liens des réseaux sociaux de l'organisation, issus des
 * variables d'environnement `EMAIL_SOCIAL_*`. Ces liens alimentent le pied de
 * page (icônes) de tous les e-mails transactionnels sortants.
 */
export function emailSocialFromEnv(config: ConfigService): EmailSocial {
  return {
    facebook: config.get<string>('EMAIL_SOCIAL_FACEBOOK')?.trim() || undefined,
    instagram:
      config.get<string>('EMAIL_SOCIAL_INSTAGRAM')?.trim() || undefined,
    linkedin: config.get<string>('EMAIL_SOCIAL_LINKEDIN')?.trim() || undefined,
    twitter: config.get<string>('EMAIL_SOCIAL_TWITTER')?.trim() || undefined,
    youtube: config.get<string>('EMAIL_SOCIAL_YOUTUBE')?.trim() || undefined,
  };
}
