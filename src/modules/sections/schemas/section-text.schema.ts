import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SectionTextDocument = HydratedDocument<SectionText>;

/** The generic fields that can appear in any landing section. */
export interface FaqItem {
  question: string;
  answer: string;
}

@Schema({ timestamps: true })
export class SectionText {
  @Prop({ default: '' })
  eyebrow: string;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  buttonLabel: string;

  /** Image d'arrière-plan (newsletter). */
  @Prop({ default: '' })
  backgroundImage?: string;

  /** Visibilité de la section (newsletter, FAQ). */
  @Prop({ default: true })
  visible?: boolean;

  /** Éléments de la FAQ. */
  @Prop({ type: [{ question: { type: String, default: '' }, answer: { type: String, default: '' } }], default: [] })
  items?: FaqItem[];
}

export const SectionTextSchema = SchemaFactory.createForClass(SectionText);