import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsCategoryDocument = HydratedDocument<NewsCategory>;

@Schema({
  timestamps: true,
  collection: 'news_categories',
})
export class NewsCategory {
  @Prop({ required: true, trim: true, unique: true })
  name: string;
}

export const NewsCategorySchema = SchemaFactory.createForClass(NewsCategory);