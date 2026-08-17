import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TwoFactorCodeDocument = HydratedDocument<TwoFactorCode>;

@Schema({
  timestamps: true,
  collection: 'two-factor-codes',
})
export class TwoFactorCode {
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true, index: true })
  adminId: string;

  @Prop({ required: true, length: 6 })
  code: string;

  @Prop({ default: false })
  used: boolean;

  @Prop({ required: true })
  expiresAt: Date;
}

export const TwoFactorCodeSchema = SchemaFactory.createForClass(TwoFactorCode);

TwoFactorCodeSchema.index({ adminId: 1, expiresAt: 1 });
