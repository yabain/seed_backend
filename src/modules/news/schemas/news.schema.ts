import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsDocument = HydratedDocument<News>;

export type NewsStatus = 'draft' | 'published';

@Schema({
  timestamps: true,
  collection: 'news',
})
export class News {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, unique: true, sparse: true })
  slug: string;

  @Prop({ trim: true })
  excerpt: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ type: [String], default: [] })
  gallery: string[];

  @Prop({ default: 'Organisation' })
  author: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ enum: ['draft', 'published'], default: 'draft' })
  status: NewsStatus;

  @Prop({ default: false })
  isVisibleOnLanding: boolean;

  @Prop()
  publishedAt: Date;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  /** Indique que cette actualité est « à la une » (une seule par site). */
  @Prop({ default: false, index: true })
  isFeatured: boolean;
}

export const NewsSchema = SchemaFactory.createForClass(News);
