import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { TranslationLang } from '../platform-settings/platform-settings.schema';
import { TranslateBody, TranslateResponse } from './translation.types';
import { TranslateDto } from './dto/translate.dto';

const DEEPL_FREE_HOST = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO_HOST = 'https://api.deepl.com/v2/translate';
const GOOGLE_FREE_ENDPOINT =
  'https://translate.googleapis.com/translate_a/single';
const GOOGLE_SL = 'auto';
const MAX_CHARS_PER_SEGMENT = 5000;

/** Plafond du volume total (caractères) accepté par requête de traduction. */
const MAX_TOTAL_CHARS_PER_REQUEST = 50_000;

interface DeeplResponse {
  translations: { text: string }[];
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Traduit un lot de textes via le moteur configuré (DeepL ou Google).
   * Le résultat est toujours aligné sur l'entrée : en cas d'échec d'un segment,
   * il est renvoyé tel quel pour ne jamais casser la page.
   */
  async translate(body: TranslateBody): Promise<TranslateResponse> {
    const config = await this.platformSettingsService.getTranslationConfigWithKeyFromDb();

    // C2 : refuse la traduction si la fonctionnalité est désactivée en paramètres.
    if (!config.enabled) {
      throw new ForbiddenException(
        'La traduction est désactivée sur la plateforme.',
      );
    }

    const allTexts = body.texts ?? [];

    // Plafond de volume total par requête (protection anti-abus d'une API payante).
    const totalChars = allTexts.reduce((sum, t) => sum + (t?.length ?? 0), 0);
    if (totalChars > MAX_TOTAL_CHARS_PER_REQUEST) {
      throw new ForbiddenException(
        'Volume de traduction trop important pour une seule requête.',
      );
    }

    const filtered = allTexts.filter(
      (t) => typeof t === 'string' && t.trim().length > 0,
    );

    const filteredTranslations = await this.translateByProvider(
      body.targetLang,
      filtered,
      config.provider,
      config.deeplApiKey,
    );

    // Ré-aligne sur l'entrée : les textes vides restent vides.
    const translations: string[] = [];
    let fi = 0;
    for (const t of allTexts) {
      if (typeof t !== 'string' || t.trim().length === 0) {
        translations.push(t);
      } else {
        translations.push(filteredTranslations[fi] ?? '');
        fi++;
      }
    }

    return { translations };
  }

  private async translateByProvider(
    targetLang: TranslationLang,
    texts: string[],
    provider: 'google' | 'deepl',
    deeplApiKey: string,
  ): Promise<string[]> {
    if (provider === 'deepl') {
      if (!deeplApiKey) {
        throw new Error(
          'Aucune clé API DeepL configurée. Renseignez-la dans Paramètres > Traduction.',
        );
      }
      return this.translateWithDeepL(targetLang, texts, deeplApiKey);
    }
    return this.translateWithGoogle(targetLang, texts);
  }

  // ── DeepL ───────────────────────────────────────────────────────────────
  private async translateWithDeepL(
    targetLang: TranslationLang,
    texts: string[],
    apiKey: string,
  ): Promise<string[]> {
    // Une clé DeepL gratuite se termine par « :fx » (format courant) ou « :free ».
    const isFreeKey = /:(fx|free)$/i.test(apiKey);
    const host = isFreeKey ? DEEPL_FREE_HOST : DEEPL_PRO_HOST;
    const target = this.deeplTargetLang(targetLang);

    // DeepL a une limite de caractères par requête ; on découpe en lots.
    const batches: string[][] = [];
    let current: string[] = [];
    let currentChars = 0;
    for (const text of texts) {
      const len = text.length;
      if (current.length && currentChars + len > MAX_CHARS_PER_SEGMENT) {
        batches.push(current);
        current = [];
        currentChars = 0;
      }
      current.push(text);
      currentChars += len;
    }
    if (current.length) {
      batches.push(current);
    }
    if (batches.length === 0) {
      return [];
    }

    const results: string[] = [];
    for (const batch of batches) {
      const params = new URLSearchParams();
      params.set('target_lang', target);
      batch.forEach((text, i) => params.append(`text[${i}]`, text));

      const res = await fetch(host, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body: params.toString(),
      });

      if (!res.ok) {
        // Ne jamais logguer l'en-tête Authorization ni le corps de requête (clé secrète).
        this.logger.error(`DeepL error ${res.status}`);
        // Repli : renvoyer le lot tel quel plutôt que de casser la page.
        results.push(...batch);
        continue;
      }

      const data = (await res.json()) as DeeplResponse;
      const translated = (data.translations ?? []).map((t) => t.text);
      results.push(...batch.map((_, i) => translated[i] ?? batch[i]));
    }
    return results;
  }

  // ── Google (endpoint libre) ──────────────────────────────────────────────
  private async translateWithGoogle(
    targetLang: TranslationLang,
    texts: string[],
  ): Promise<string[]> {
    const results: string[] = [];
    for (const text of texts) {
      const url =
        `${GOOGLE_FREE_ENDPOINT}?client=gtx&sl=${GOOGLE_SL}&tl=${targetLang}` +
        `&dt=t&q=${encodeURIComponent(text)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`google http ${res.status}`);
        }
        const data = (await res.json()) as unknown[][];
        if (!Array.isArray(data) || !Array.isArray(data[0])) {
          throw new Error('google malformed response');
        }
        const translated = (data[0] as [string, unknown][])
          .map((pair) => (Array.isArray(pair) ? String(pair[0] ?? '') : ''))
          .join('');
        results.push(translated || text);
      } catch (err) {
        this.logger.warn(`Google translation failed: ${(err as Error).message}`);
        results.push(text);
      }
    }
    return results;
  }

  private deeplTargetLang(lang: TranslationLang): string {
    // EN-US / EN-GB sont acceptés par DeepL FR⇄EN.
    return lang === 'fr' ? 'FR' : 'EN-US';
  }
}