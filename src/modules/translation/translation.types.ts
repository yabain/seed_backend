import { TranslationLang } from '../platform-settings/platform-settings.schema';

/**
 * Corps attendu par le proxy de traduction public.
 * `targetLang` est la langue de destination ('fr' ou 'en'), `texts` est le lot
 * de segments de la page (garde dédupliquée côté front).
 */
export interface TranslateBody {
  targetLang: TranslationLang;
  texts: string[];
}

/** Réponse alignée sur l'entrée : translations[i] correspond à texts[i]. */
export interface TranslateResponse {
  translations: string[];
}