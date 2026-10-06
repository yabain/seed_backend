import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CryptService } from '../crypt/crypt.service';
import {
  PlatformSettings,
  PlatformSettingsDocument,
  TranslationConfig,
  TranslationLang,
  TranslationProvider,
} from './platform-settings.schema';

const SETTINGS_KEY = 'public';

/**
 * Clé DÉDIÉE au chiffrement du GOOGLE_CLIENT_ID. Le client id n'est pas un
 * secret (il est présent dans toute app OAuth) mais est stocké chiffré par
 * mesure d'hygiène. La MÊME valeur doit être embarquée dans le frontend
 * (`environment.cryptKey`) pour permettre le déchiffrement côté navigateur.
 *
 * On se base sur `CRYPT_KEY` (variable d'environnement déjà utilisée pour la
 * cryptographie de la plateforme) pour garantir la cohérence avec le réglage
 * renseigné par l'administrateur.
 */
const GOOGLE_CLIENT_ID_CRYPT_KEY =
  process.env.CRYPT_KEY ?? 'seed-google-client-id-key';

export interface WhatsappGatewayResponse {
  url: string;
  enabled: boolean;
  hasPassword: boolean;
}

export interface UpdateWhatsappGatewayInput {
  url?: string;
  password?: string;
  enabled?: boolean;
}

/** Configuration de traduction exposée au front (jamais la clé elle-même). */
export interface TranslationSettingsResponse {
  enabled: boolean;
  defaultLanguage: TranslationLang;
  provider: TranslationProvider;
  hasDeeplKey: boolean;
}

/** Configuration de traduction publique (bouton flottant du front office). */
export interface PublicTranslationSettingsResponse {
  enabled: boolean;
  defaultLanguage: TranslationLang;
  provider: TranslationProvider;
}

export interface UpdateTranslationInput {
  enabled?: boolean;
  defaultLanguage?: TranslationLang;
  provider?: TranslationProvider;
  deeplApiKey?: string;
}

/** Configuration d'authentification exposée au front (jamais la clé en clair). */
export interface AuthSettingsResponse {
  twoFactorEnabled: boolean;
  googleLoginEnabled: boolean;
  hasGoogleClientId: boolean;
}

export interface UpdateAuthInput {
  twoFactorEnabled?: boolean;
  googleLoginEnabled?: boolean;
  googleClientId?: string;
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectModel(PlatformSettings.name)
    private readonly settingsModel: Model<PlatformSettingsDocument>,
    private readonly cryptService: CryptService,
  ) {}

  /**
   * Récupère (ou crée) le document singleton des paramètres de la plateforme.
   */
  private async getOrCreateSettings(): Promise<PlatformSettingsDocument> {
    const existing = await this.settingsModel.findOne({ key: SETTINGS_KEY });
    if (existing) return existing;
    return this.settingsModel.create({
      key: SETTINGS_KEY,
      whatsappGateway: {},
    });
  }

  /**
   * Retourne la configuration WhatsApp gateway (sans exposer le mot de passe).
   */
  async getWhatsappGateway(): Promise<WhatsappGatewayResponse> {
    const settings = await this.getOrCreateSettings();
    return this.buildGatewayResponse(settings.whatsappGateway);
  }

  /**
   * Met à jour la configuration WhatsApp gateway. Le mot de passe est chiffré
   * via CryptService avant d'être stocké.
   */
  async updateWhatsappGateway(
    input: UpdateWhatsappGatewayInput,
  ): Promise<WhatsappGatewayResponse> {
    await this.getOrCreateSettings();

    const set: Record<string, unknown> = {};
    if (input.url !== undefined) {
      set['whatsappGateway.url'] = String(input.url || '').trim();
    }
    if (input.enabled !== undefined) {
      set['whatsappGateway.enabled'] = !!input.enabled;
    }
    if (input.password !== undefined) {
      set['whatsappGateway.encryptedPassword'] = input.password
        ? this.cryptService.encrypt(input.password)
        : '';
    }

    const updated = await this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: set },
      { new: true },
    );

    return this.buildGatewayResponse(updated?.whatsappGateway);
  }

  /**
   * Retourne la config WhatsApp gateway depuis la DB (avec mot de passe
   * déchiffré), ou null si non configurée. Utilisée par WhatsappService.
   */
  async getWhatsappGatewayFromDb(): Promise<{
    url: string;
    decryptedPassword: string;
  } | null> {
    const settings = await this.getOrCreateSettings();
    const gw = settings.whatsappGateway;
    if (!gw || !gw.url) return null;

    let decryptedPassword = '';
    if (gw.encryptedPassword) {
      try {
        decryptedPassword = this.cryptService.decrypt(gw.encryptedPassword);
      } catch {
        // Si le déchiffrement échoue, on retourne une chaîne vide.
        decryptedPassword = '';
      }
    }

    return { url: gw.url, decryptedPassword };
  }

  /**
   * Retourne la config de traduction exposée au front (sans jamais exposer la clé
   * DeepL en clair ; seul `hasDeeplKey` est renvoyé).
   */
  async getTranslationSettings(): Promise<TranslationSettingsResponse> {
    const settings = await this.getOrCreateSettings();
    const tr = settings.translation || {};
    return {
      enabled: tr.enabled ?? false,
      defaultLanguage: tr.defaultLanguage ?? 'fr',
      provider: tr.provider ?? 'google',
      hasDeeplKey: !!tr.encryptedDeeplApiKey,
    };
  }

  /** Version publique (bouton flottant) : aucun secret, accessible sans auth. */
  async getPublicTranslationSettings(): Promise<PublicTranslationSettingsResponse> {
    const settings = await this.getOrCreateSettings();
    const tr = settings.translation || {};
    return {
      enabled: tr.enabled ?? false,
      defaultLanguage: tr.defaultLanguage ?? 'fr',
      provider: tr.provider ?? 'google',
    };
  }

  /**
   * Met à jour la config de traduction. Si `deeplApiKey` est fournie, elle est
   * chiffrée via CryptService avant stockage. Une clé vide conserve la clé
   * existante.
   */
  async updateTranslationSettings(
    input: UpdateTranslationInput,
  ): Promise<TranslationSettingsResponse> {
    await this.getOrCreateSettings();

    const set: Record<string, unknown> = {};
    if (input.enabled !== undefined) {
      set['translation.enabled'] = !!input.enabled;
    }
    if (input.defaultLanguage !== undefined) {
      set['translation.defaultLanguage'] = input.defaultLanguage;
    }
    if (input.provider !== undefined) {
      set['translation.provider'] = input.provider;
    }
    if (input.deeplApiKey !== undefined && input.deeplApiKey !== '') {
      set['translation.encryptedDeeplApiKey'] =
        this.cryptService.encrypt(String(input.deeplApiKey).trim());
    }

    const updated = await this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: set },
      { new: true },
    );

    return this.buildTranslationResponse(updated?.translation);
  }

  /** Retourne la config de traduction avec la clé DeepL déchiffrée (usage interne). */
  async getTranslationConfigWithKeyFromDb(): Promise<{
    enabled: boolean;
    defaultLanguage: TranslationLang;
    provider: TranslationProvider;
    deeplApiKey: string;
  }> {
    const settings = await this.getOrCreateSettings();
    const tr = settings.translation || {};

    let deeplApiKey = '';
    if (tr.encryptedDeeplApiKey) {
      try {
        deeplApiKey = this.cryptService.decrypt(tr.encryptedDeeplApiKey);
      } catch {
        deeplApiKey = '';
      }
    }

    return {
      enabled: tr.enabled ?? false,
      defaultLanguage: tr.defaultLanguage ?? 'fr',
      provider: tr.provider ?? 'google',
      deeplApiKey,
    };
  }

  private buildTranslationResponse(
    config?: PlatformSettings['translation'],
  ): TranslationSettingsResponse {
    const tr: TranslationConfig = config || {};
    return {
      enabled: tr.enabled ?? false,
      defaultLanguage: tr.defaultLanguage ?? 'fr',
      provider: tr.provider ?? 'google',
      hasDeeplKey: !!tr.encryptedDeeplApiKey,
    };
  }

  // ── Authentification ──────────────────────────────────────────────────────

  /** Retourne la config d'authentification (jamais la clé Google en clair). */
  async getAuthSettings(): Promise<AuthSettingsResponse> {
    const settings = await this.getOrCreateSettings();
    const auth = settings.auth || {};
    return {
      twoFactorEnabled: auth.twoFactorEnabled ?? true,
      googleLoginEnabled: auth.googleLoginEnabled ?? true,
      hasGoogleClientId: !!auth.encryptedGoogleClientId,
    };
  }

  /**
   * Version publique (page de connexion) : 2FA + bouton Google. Le
   * GOOGLE_CLIENT_ID est renvoyé CHIFFRÉ pour déchiffrement côté front ; il
   * n'est jamais exposé en clair.
   */
  async getPublicAuthSettings(): Promise<{
    twoFactorEnabled: boolean;
    googleLoginEnabled: boolean;
    encryptedGoogleClientId: string;
  }> {
    const settings = await this.getOrCreateSettings();
    const auth = settings.auth || {};
    return {
      twoFactorEnabled: auth.twoFactorEnabled ?? true,
      googleLoginEnabled: auth.googleLoginEnabled ?? true,
      encryptedGoogleClientId: auth.encryptedGoogleClientId ?? '',
    };
  }

  /**
   * Met à jour la config d'authentification. Si `googleClientId` est fournie,
   * elle est chiffrée via CryptService. Une valeur vide conserve l'existant.
   */
  async updateAuthSettings(
    input: UpdateAuthInput,
  ): Promise<AuthSettingsResponse> {
    const current = await this.getAuthSettings();

    const nextGoogleEnabled =
      input.googleLoginEnabled !== undefined
        ? !!input.googleLoginEnabled
        : current.googleLoginEnabled;

    // Validation serveur : activer Google sans client id (existant) est refusé.
    if (
      nextGoogleEnabled &&
      !current.hasGoogleClientId &&
      (input.googleClientId === undefined || input.googleClientId.trim() === '')
    ) {
      throw new BadRequestException(
        'Un GOOGLE_CLIENT_ID est requis pour activer la connexion Google.',
      );
    }

    await this.getOrCreateSettings();

    const set: Record<string, unknown> = {};
    if (input.twoFactorEnabled !== undefined) {
      set['auth.twoFactorEnabled'] = !!input.twoFactorEnabled;
    }
    if (input.googleLoginEnabled !== undefined) {
      set['auth.googleLoginEnabled'] = !!input.googleLoginEnabled;
    }
    if (input.googleClientId !== undefined && input.googleClientId !== '') {
      set['auth.encryptedGoogleClientId'] = this.cryptService.encrypt(
        String(input.googleClientId).trim(),
        GOOGLE_CLIENT_ID_CRYPT_KEY,
      );
    }

    const updated = await this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: set },
      { new: true },
    );

    return this.buildAuthResponse(updated?.auth);
  }

  /**
   * Retourne la config d'authentification avec le GOOGLE_CLIENT_ID déchiffré
   * (usage interne par AuthService). Fallback sur la variable d'environnement
   * si la base est vide.
   */
  async getAuthConfigWithKeyFromDb(): Promise<{
    twoFactorEnabled: boolean;
    googleLoginEnabled: boolean;
    googleClientId: string;
  }> {
    const settings = await this.getOrCreateSettings();
    const auth = settings.auth || {};

    let googleClientId = '';
    if (auth.encryptedGoogleClientId) {
      try {
        googleClientId = this.cryptService.decrypt(
          auth.encryptedGoogleClientId,
          GOOGLE_CLIENT_ID_CRYPT_KEY,
        );
      } catch {
        googleClientId = '';
      }
    }

    return {
      twoFactorEnabled: auth.twoFactorEnabled ?? true,
      googleLoginEnabled: auth.googleLoginEnabled ?? true,
      googleClientId,
    };
  }

  private buildAuthResponse(config?: PlatformSettings['auth']): AuthSettingsResponse {
    const auth = config || {};
    return {
      twoFactorEnabled: auth.twoFactorEnabled ?? true,
      googleLoginEnabled: auth.googleLoginEnabled ?? true,
      hasGoogleClientId: !!auth.encryptedGoogleClientId,
    };
  }

  private buildGatewayResponse(
    gateway?: PlatformSettings['whatsappGateway'],
  ): WhatsappGatewayResponse {
    const gw = gateway || {};
    return {
      url: gw.url || '',
      enabled: gw.enabled ?? true,
      hasPassword: !!gw.encryptedPassword,
    };
  }
}
