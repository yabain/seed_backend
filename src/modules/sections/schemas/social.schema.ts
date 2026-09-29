import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SocialDocument = HydratedDocument<Social>;

@Schema({ timestamps: true })
export class Social {
  @Prop({ default: '' }) facebook: string;
  @Prop({ default: '' }) instagram: string;
  @Prop({ default: '' }) linkedin: string;
  @Prop({ default: '' }) twitter: string;
  @Prop({ default: '' }) youtube: string;
}

export const SocialSchema = SchemaFactory.createForClass(Social);