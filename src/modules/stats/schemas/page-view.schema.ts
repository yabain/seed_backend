import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PageViewDocument = HydratedDocument<PageView>;

/**
 * Enregistre une page vue ou une visite unique.
 * - Une "visite" est créée une seule fois par visiteur et par jour (doublons ignorés).
 * - Une "page view" est créée à chaque navigation.
 */
@Schema({
  timestamps: true,
  collection: 'page_views',
})
export class PageView {
  @Prop({ required: true, trim: true })
  path: string;

  @Prop({ required: true, trim: true })
  visitorId: string;

  @Prop({ default: 'pageview' })
  type: string;

  @Prop({ trim: true })
  referrer: string;

  @Prop({ trim: true })
  userAgent: string;
}

export const PageViewSchema = SchemaFactory.createForClass(PageView);

PageViewSchema.index({ visitorId: 1, path: 1, type: 1, createdAt: 1 });
