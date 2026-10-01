import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CryptService } from '../crypt/crypt.service';
import {
  PlatformSettings,
  PlatformSettingsDocument,
} from './platform-settings.schema';

const SETTINGS_KEY = 'public';

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
