import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AboutDocument = HydratedDocument<About>;

@Schema({
  timestamps: true,
  collection: 'about',
})
export class About {
  @Prop({ default: '' })
  mission: string;

  @Prop({ default: '' })
  vision: string;

  @Prop({ type: [String], default: ['', '', ''] })
  values: string[];

  @Prop({ default: '' })
  visual: string;

  @Prop({ default: '' })
  sectionEyebrow: string;

  @Prop({ default: '' })
  titleLine1: string;

  @Prop({ default: '' })
  titleLine2: string;

  @Prop({ default: '' })
  sectionDescription: string;

  @Prop({ default: '' })
  floatingCard1Icon: string;

  @Prop({ default: '' })
  floatingCard1Label: string;

  @Prop({ default: '' })
  floatingCard1Value: string;

  @Prop({ default: '' })
  floatingCard2Icon: string;

  @Prop({ default: '' })
  floatingCard2Label: string;

  @Prop({ default: '' })
  floatingCard2Value: string;
}

export const AboutSchema = SchemaFactory.createForClass(About);
