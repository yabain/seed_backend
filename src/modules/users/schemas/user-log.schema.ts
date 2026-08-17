import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserLogDocument = HydratedDocument<UserLog>;

@Schema({
  timestamps: true,
  collection: 'user-logs',
})
export class UserLog {
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true, index: true })
  actorId: string;

  @Prop({ trim: true })
  actorEmail: string;

  @Prop({ trim: true })
  actorRole: string;

  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ type: Types.ObjectId, ref: 'Admin', index: true })
  userId: string;

  @Prop({ trim: true })
  userEmail: string;

  @Prop({ type: Object })
  metadata: Record<string, unknown>;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;
}

export const UserLogSchema = SchemaFactory.createForClass(UserLog);

UserLogSchema.index({ userId: 1, createdAt: -1 });
UserLogSchema.index({ actorId: 1, createdAt: -1 });
UserLogSchema.index({ action: 1, createdAt: -1 });
