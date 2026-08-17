import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProgramDocument = HydratedDocument<Program>;

@Schema({
  timestamps: true,
  collection: 'programs',
})
export class Program {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  excerpt: string;

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

export const ProgramSchema = SchemaFactory.createForClass(Program);
