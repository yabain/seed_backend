import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VideoHighlightSectionDocument = HydratedDocument<VideoHighlightSection>;

@Schema({ timestamps: true, collection: 'video_highlight_section' })
export class VideoHighlightSection {
  @Prop({ default: '' }) eyebrow: string;
  @Prop({ default: '' }) title: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) buttonLabel: string;
  @Prop({ default: '' }) buttonLink: string;
  @Prop({ default: '' }) videoUrl: string;
  @Prop({ default: true }) visible: boolean;
}

export const VideoHighlightSectionSchema = SchemaFactory.createForClass(VideoHighlightSection);
