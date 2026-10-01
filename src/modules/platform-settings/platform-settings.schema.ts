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

@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  /** Clé du document singleton. */
  @Prop({ required: true, unique: true, default: 'public' })
  key: string;

  @Prop({ type: Object, default: {} })
  whatsappGateway: WhatsappGatewayConfig;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);