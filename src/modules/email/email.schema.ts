import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailDocument = HydratedDocument<EmailLog>;

@Schema({ timestamps: true, collection: 'emails' })
export class EmailLog {
  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true, default: false })
  status: boolean;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);

EmailLogSchema.index({ createdAt: -1 });
EmailLogSchema.index({ to: 1, createdAt: -1 });
