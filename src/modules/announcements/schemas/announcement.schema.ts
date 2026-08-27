import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AnnouncementDocument = HydratedDocument<Announcement>;

export const ANNOUNCEMENT_GROUPS = [
  'all_accounts',
  'all_users',
  'all_consultants',
  'all_admins',
  'all_prospects',
] as const;
export type AnnouncementRecipientGroup = (typeof ANNOUNCEMENT_GROUPS)[number];

export const GROUP_LABELS: Record<AnnouncementRecipientGroup, string> = {
  all_accounts: 'Tous les comptes',
  all_users: 'Tous les utilisateurs simples',
  all_consultants: 'Tous les consultants',
  all_admins: 'Tous les administrateurs',
  all_prospects: 'Tous les prospects',
};

export const ANNOUNCEMENT_STATUSES = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  sending: 'En cours',
  sent: 'Envoyé',
  failed: 'Échec',
};

export interface AnnouncementAttachment {
  fileName: string;
  path: string;
  size: number;
}

export class AnnouncementDelivery {
  @Prop({ required: true })
  email!: string;

  @Prop()
  userId?: string;

  @Prop({ default: '' })
  userName?: string;

  @Prop({ default: '' })
  userPhone?: string;

  @Prop({
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  })
  status!: 'pending' | 'sent' | 'failed';

  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  error?: string;

  @Prop({ type: Date })
  sentAt?: Date | null;
}

@Schema({
  timestamps: true,
  collection: 'announcements',
})
export class Announcement {
  @Prop({ required: true, trim: true })
  subject!: string;

  @Prop({ required: true })
  bodyHtml!: string;

  @Prop({
    enum: ANNOUNCEMENT_GROUPS,
    required: true,
  })
  recipientGroup!: AnnouncementRecipientGroup;

  @Prop({ type: [String], default: [] })
  customRecipients!: string[];

  @Prop({
    enum: ANNOUNCEMENT_STATUSES,
    default: 'draft',
  })
  status!: AnnouncementStatus;

  @Prop({ type: Date, default: null })
  scheduledAt?: Date | null;

  @Prop({ type: Date, default: null })
  sentAt?: Date | null;

  @Prop({ default: true })
  includeHeader!: boolean;

  @Prop({ default: true })
  includeFooter!: boolean;

  @Prop({ default: '' })
  error?: string;

  @Prop({ type: Date, default: null })
  lastRunAt?: Date | null;

  @Prop({ type: Object, default: {} })
  attachments!: AnnouncementAttachment[];

  @Prop({ type: [AnnouncementDelivery], default: [] })
  deliveries!: AnnouncementDelivery[];

  @Prop({ default: false })
  processing!: boolean;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

AnnouncementSchema.index({ createdAt: -1 });
AnnouncementSchema.index({ status: 1 });
