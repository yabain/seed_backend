import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

@Schema({
  timestamps: true,
  collection: 'partners',
})
export class Partner {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  logo: string;

  @Prop({ default: '' })
  website: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  phone1: string;

  @Prop({ default: '' })
  phone2: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
