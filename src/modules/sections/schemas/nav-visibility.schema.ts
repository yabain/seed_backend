import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NavVisibilityDocument = HydratedDocument<NavVisibility>;

@Schema({ timestamps: true })
export class NavVisibility {
  @Prop({ default: true }) news: boolean;
  @Prop({ default: true }) resources: boolean;
  @Prop({ default: true }) programs: boolean;
  @Prop({ default: true }) partners: boolean;
  @Prop({ default: true }) events: boolean;
  @Prop({ default: true }) team: boolean;
  @Prop({ default: true }) donations: boolean;
  @Prop({ default: true }) recruitments: boolean;
  @Prop({ default: true }) avis: boolean;
}

export const NavVisibilitySchema = SchemaFactory.createForClass(NavVisibility);