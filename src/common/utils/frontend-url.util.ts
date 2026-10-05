import { ConfigService } from '@nestjs/config';

/**
 * Résout la base d'URL du front-office (ex. https://udm.cm) pour construire des
 * liens (reset de mot de passe, pages Open Graph, e-mails).
 *
 * Priorité :
 * 1. `origin` passé explicitement (en-tête Origin de la requête, ou paramètre
 *    `host` pour les pages OGP) — permet d'utiliser le bon domaine du site en
 *    présence de plusieurs vitrines / domaines.
 * 2. `FRONTEND_URL`.
 * 3. Premier item de `CLIENT_ORIGIN`.
 * 4. Défaut : http://localhost:4200.
 */
export function resolveFrontendBase(
  origin?: string,
  configService?: ConfigService,
): string {
  const requested =
    typeof origin === 'string' && /^https?:\/\//i.test(origin.trim())
      ? origin.trim().replace(/\/+$/, '')
      : '';
  if (requested) {
    return requested;
  }

  if (configService) {
    const explicit = configService.get<string>('FRONTEND_URL');
    if (explicit) {
      return explicit.replace(/\/+$/, '');
    }
    const clientOrigin = configService
      .get<string>('CLIENT_ORIGIN')
      ?.split(',')[0]
      ?.trim();
    if (clientOrigin) {
      return clientOrigin.replace(/\/+$/, '');
    }
  }
  return 'http://localhost:4200';
}

/**
 * Résout la base du front-office pour les pages OGP, appelées par les robots
 * après une redirection depuis le front. On reçoit le domaine demandé via le
 * paramètre `host` (ajouté par `.htaccess`) : `host` = udm.cm → https://udm.cm.
 */
export function resolveOgpFrontendBase(
  queryHost: string | undefined,
  configService: ConfigService,
): string {
  const host = String(queryHost || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
  const hostRe = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
  if (host && hostRe.test(host)) {
    return `https://${host}`;
  }
  return resolveFrontendBase(undefined, configService);
}

/**
 * Pied de page ajouté à TOUS les messages WhatsApp envoyés automatiquement
 * (2FA, reset, identifiants, contact, newsletter, candidatures) — jamais aux
 * annonces rédigées manuellement. Le domaine est tiré de l'origine du front
 * (ex. udm.cm), ou surchargé par WHATSAPP_NOTIF_SIGNATURE si défini.
 */
export function whatsappNotificationFooter(
  configService?: ConfigService,
): string {
  const explicit = configService?.get<string>('WHATSAPP_NOTIF_SIGNATURE');
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }
  let host = '';
  try {
    host = new URL(resolveFrontendBase(undefined, configService)).host;
  } catch {
    host = '';
  }
  return `> Ceci est un message automatique généré par notre système${host ? ` ${host}` : ''}`;
}