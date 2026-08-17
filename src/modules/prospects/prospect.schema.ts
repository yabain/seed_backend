import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProspectDocument = HydratedDocument<Prospect>;

@Schema({ timestamps: true, collection: 'prospects' })
export class Prospect {
  @Prop({ trim: true, default: '' })
  name: string;

  @Prop({ trim: true, lowercase: true, default: '' })
  email: string;

  @Prop({ trim: true, default: '' })
  phone: string;
}

export const ProspectSchema = SchemaFactory.createForClass(Prospect);

ProspectSchema.index({ email: 1 }, { unique: true, sparse: true });
ProspectSchema.index({ phone: 1 }, { unique: true, sparse: true });
ProspectSchema.index({ createdAt: -1 });
