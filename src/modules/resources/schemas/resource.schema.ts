import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResourceDocument = HydratedDocument<Resource>;

@Schema({
  timestamps: true,
  collection: 'resources',
})
export class Resource {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  category: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  previewImage: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: '' })
  fileType: string;

  @Prop({ default: 0 })
  fileSize: number;

  @Prop({ default: true })
  isPublished: boolean;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);
