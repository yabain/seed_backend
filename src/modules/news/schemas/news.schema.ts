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

  @Prop({ default: 'Organisation' })
  author: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ enum: ['draft', 'published'], default: 'draft' })
  status: NewsStatus;

  @Prop()
  publishedAt: Date;
}

export const NewsSchema = SchemaFactory.createForClass(News);
