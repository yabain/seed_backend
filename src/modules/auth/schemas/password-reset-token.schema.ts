import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;

@Schema({
  timestamps: true,
  collection: 'password-reset-tokens',
})
export class PasswordResetToken {
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true, index: true })
  adminId: string;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ default: false })
  used: boolean;

  @Prop({ required: true })
  expiresAt: Date;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

PasswordResetTokenSchema.index({ tokenHash: 1, used: 1, expiresAt: 1 });
PasswordResetTokenSchema.index({ adminId: 1, expiresAt: 1 });
