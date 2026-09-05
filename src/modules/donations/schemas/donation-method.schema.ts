import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type DonationMethodDocument = HydratedDocument<DonationMethod>;

@Schema({ timestamps: true })
export class DonationMethod {
  @Prop({ unique: true, sparse: true })
  name: string;

  @Prop({ default: '' })
  logo: string;

  @Prop({ default: '' })
  qrCodeImage: string;

  @Prop({ default: '' })
  paymentLink: string;

  @Prop({ default: '' })
  details?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export const DonationMethodSchema = SchemaFactory.createForClass(DonationMethod);