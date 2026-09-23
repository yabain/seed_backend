import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VirtualTourSectionDocument = HydratedDocument<VirtualTourSection>;

@Schema({ timestamps: true, collection: 'virtual_tour_section' })
export class VirtualTourSection {
  @Prop({ default: 'Virtual Tour' }) eyebrow: string;
  @Prop({ default: 'Visite virtuelle — 360°' }) title: string;
  @Prop({ default: '' }) subtitle: string;
  @Prop({ default: '' }) url: string;
  @Prop({ default: true }) visible: boolean;
}

export const VirtualTourSectionSchema =
  SchemaFactory.createForClass(VirtualTourSection);
