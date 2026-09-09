import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ImpactDocument = HydratedDocument<Impact>;

@Schema({
  timestamps: true,
  collection: 'impacts',
})
export class Impact {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  metric: string;

  @Prop({ default: '', trim: true })
  subtitle: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  visual: string;

  @Prop({ default: '' })
  icon: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ImpactSchema = SchemaFactory.createForClass(Impact);
