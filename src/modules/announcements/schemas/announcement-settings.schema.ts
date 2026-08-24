import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AnnouncementSettingsDocument = HydratedDocument<AnnouncementSettings>;

@Schema({
  timestamps: true,
  collection: 'announcement_settings',
})
export class AnnouncementSettings {
  @Prop({ default: '' })
  headerHtml!: string;

  @Prop({ default: '' })
  footerHtml!: string;
}

export const AnnouncementSettingsSchema = SchemaFactory.createForClass(
  AnnouncementSettings,
);

AnnouncementSettingsSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const raw = ret as unknown as Record<string, unknown>;
    const out = { ...raw };
    delete out._id;
    delete out.__v;
    return { id: String(raw._id), ...out };
  },
});
