import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface HoverMenuItem {
  title: string;
  description: string;
  link: string;
}

export type HoverMenuDocument = HydratedDocument<HoverMenu>;

@Schema({ timestamps: true })
export class HoverMenu {
  @Prop({ default: false }) enabled: boolean;
  @Prop({ default: '' }) title: string;
  @Prop({ type: [{ title: { type: String, default: '' }, description: { type: String, default: '' }, link: { type: String, default: '' } }], default: [] })
  items: HoverMenuItem[];
}

export const HoverMenuSchema = SchemaFactory.createForClass(HoverMenu);