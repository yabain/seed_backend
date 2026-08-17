import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SmtpDocument = HydratedDocument<Smtp>;

@Schema({ timestamps: true, collection: 'smtp-config' })
export class Smtp {
  @Prop({ required: true })
  smtpHost: string;

  @Prop({ required: true })
  smtpPort: string;

  @Prop({ required: true, default: false })
  smtpSecure: boolean;

  @Prop()
  smtpUser: string;

  @Prop()
  smtpPassword: string;

  @Prop({ default: 'SSL/TLS' })
  smtpEncryption: string;

  @Prop({ default: true })
  status: boolean;

  @Prop()
  emailForAlert: string;
}

export const SmtpSchema = SchemaFactory.createForClass(Smtp);
