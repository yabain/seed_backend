import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IdentityDocument = HydratedDocument<Identity>;

@Schema({ timestamps: true })
export class Identity {
  @Prop({ default: '' }) orgName: string;
  @Prop({ default: '' }) tagline: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) logo: string;
  @Prop({ default: '' }) footerLogo: string;
  @Prop({ default: '' }) favicon: string;
  @Prop({ default: '' }) ogImage: string;
  @Prop({ default: '' }) heroTitle: string;
  @Prop({ default: '' }) heroSubtitle: string;
  @Prop({ default: '' }) address: string;
  @Prop({ default: '' }) phone: string;
  @Prop({ default: '' }) phone2: string;
  @Prop({ default: '' }) email: string;
  @Prop({ default: '' }) primaryColor: string;
  @Prop({ default: '' }) secondaryColor: string;
}

export const IdentitySchema = SchemaFactory.createForClass(Identity);