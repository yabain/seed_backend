import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SiteConfigDocument = HydratedDocument<SiteConfig>;

@Schema({
  timestamps: true,
  collection: 'site_config',
})
export class SiteConfig {
  @Prop({ trim: true })
  orgName: string;

  @Prop({ trim: true })
  tagline: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  logo: string;

  @Prop({ default: '' })
  favicon: string;

  @Prop({ default: '' })
  ogImage: string;

  @Prop({ default: '' })
  heroTitle: string;

  @Prop({ default: '' })
  heroSubtitle: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  phone2: string;

  @Prop({ default: '' })
  email: string;

  @Prop({
    type: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      youtube: { type: String, default: '' },
    },
    default: {},
  })
  social: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
    youtube: string;
  };

  @Prop({
    type: {
      news: { type: Boolean, default: true },
      resources: { type: Boolean, default: true },
      programs: { type: Boolean, default: true },
      partners: { type: Boolean, default: true },
    },
    default: {},
  })
  segments: {
    news: boolean;
    resources: boolean;
    programs: boolean;
    partners: boolean;
  };
}

export const SiteConfigSchema = SchemaFactory.createForClass(SiteConfig);
