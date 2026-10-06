import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

export interface WhatsappGatewayConfig {
  /** URL de base du gateway WhatsApp Web JS (ex: https://wa.mondomaine.com). */
  url?: string;
  /** Mot de passe du gateway, chiffré via CryptService. */
  encryptedPassword?: string;
  /** Active/désactive l'usage du gateway externe. */
  enabled?: boolean;
}

export type TranslationProvider = 'google' | 'deepl';
export type TranslationLang = 'fr' | 'en';

export interface TranslationConfig {
  /** Active/désactive la traduction sur le front office (masque le bouton). */
  enabled?: boolean;
  /** Langue par défaut de la plateforme ('fr' ou 'en'). */
  defaultLanguage?: TranslationLang;
  /** Moteur de traduction choisi. */
  provider?: TranslationProvider;
  /** Clé API DeepL, chiffrée via CryptService. */
  encryptedDeeplApiKey?: string;
}

export interface AuthConfig {
  /** Active/désactive le double facteur (code 6 chiffres) sur le portail de connexion. */
  twoFactorEnabled?: boolean;
  /** Active/désactive le bouton de connexion Google. */
  googleLoginEnabled?: boolean;
  /** GOOGLE_CLIENT_ID, chiffré via CryptService (source prioritaire). */
  encryptedGoogleClientId?: string;
}

@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  /** Clé du document singleton. */
  @Prop({ required: true, unique: true, default: 'public' })
  key: string;

  @Prop({ type: Object, default: {} })
  whatsappGateway: WhatsappGatewayConfig;

  @Prop({ type: Object, default: {} })
  translation: TranslationConfig;

  @Prop({ type: Object, default: {} })
  auth: AuthConfig;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);