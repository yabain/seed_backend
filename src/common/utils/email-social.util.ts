import { ConfigService } from '@nestjs/config';

export interface EmailSocial {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
}

interface SiteConfigSocial {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
}

interface SiteConfigLike {
  logo?: string;
  orgName?: string;
  social?: SiteConfigSocial;
}

/**
 * Retourne les liens des réseaux sociaux de l'organisation.
 * Priorité : base de données (site config) > variables d'environnement.
 * Ces liens alimentent le pied de page (icônes) de tous les e-mails transactionnels sortants.
 */
export function emailSocialFromSiteConfig(
  siteConfig: SiteConfigLike | null | undefined,
  config: ConfigService,
): EmailSocial {
  const dbSocial = siteConfig?.social ?? {};
  const getEnv = (key: string) => config.get<string>(key)?.trim() || undefined;

  return {
    facebook: dbSocial.facebook?.trim() || getEnv('EMAIL_SOCIAL_FACEBOOK'),
    instagram: dbSocial.instagram?.trim() || getEnv('EMAIL_SOCIAL_INSTAGRAM'),
    linkedin: dbSocial.linkedin?.trim() || getEnv('EMAIL_SOCIAL_LINKEDIN'),
    twitter: dbSocial.twitter?.trim() || getEnv('EMAIL_SOCIAL_TWITTER'),
    youtube: dbSocial.youtube?.trim() || getEnv('EMAIL_SOCIAL_YOUTUBE'),
  };
}

/**
 * @deprecated Utiliser emailSocialFromSiteConfig qui lit depuis la BD.
 * Conservé pour compatibilité temporaire.
 */
export function emailSocialFromEnv(config: ConfigService): EmailSocial {
  return {
    facebook: config.get<string>('EMAIL_SOCIAL_FACEBOOK')?.trim() || undefined,
    instagram: config.get<string>('EMAIL_SOCIAL_INSTAGRAM')?.trim() || undefined,
    linkedin: config.get<string>('EMAIL_SOCIAL_LINKEDIN')?.trim() || undefined,
    twitter: config.get<string>('EMAIL_SOCIAL_TWITTER')?.trim() || undefined,
    youtube: config.get<string>('EMAIL_SOCIAL_YOUTUBE')?.trim() || undefined,
  };
}

/**
 * Retourne l'URL du logo pour les emails.
 * Priorité : base de données (site config) > variable d'environnement.
 */
export function emailLogoFromSiteConfig(
  siteConfig: SiteConfigLike | null | undefined,
  config: ConfigService,
): string {
  return siteConfig?.logo?.trim() || config.get<string>('EMAIL_LOGO_URL')?.trim() || '';
}
