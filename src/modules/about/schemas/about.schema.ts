import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AboutDocument = HydratedDocument<About>;

@Schema({
  timestamps: true,
  collection: 'about',
})
export class About {
  @Prop({ default: '' })
  mission: string;

  @Prop({ default: '' })
  vision: string;

  @Prop({ type: [String], default: ['', '', ''] })
  values: string[];
}

export const AboutSchema = SchemaFactory.createForClass(About);
