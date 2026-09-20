import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RecruitmentCampaignDocument = HydratedDocument<RecruitmentCampaign>;

export const RECRUITMENT_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'number',
  'url',
  'tel',
  'file',
] as const;
export type RecruitmentFieldType = (typeof RECRUITMENT_FIELD_TYPES)[number];

export const RECRUITMENT_FILE_KINDS = ['any', 'image', 'document'] as const;
export type RecruitmentFileKind = (typeof RECRUITMENT_FILE_KINDS)[number];

export const RECRUITMENT_CAMPAIGN_STATUSES = ['published', 'archived'] as const;
export type RecruitmentCampaignStatus =
  (typeof RECRUITMENT_CAMPAIGN_STATUSES)[number];

@Schema({ _id: false })
export class RecruitmentFormField {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ enum: RECRUITMENT_FIELD_TYPES, default: 'text' })
  type: RecruitmentFieldType;

  @Prop({ default: false })
  required: boolean;

  @Prop({ default: '' })
  placeholder: string;

  @Prop({ default: '' })
  helpText: string;

  @Prop({ enum: RECRUITMENT_FILE_KINDS, default: 'any' })
  fileKind: RecruitmentFileKind;

  @Prop({ default: 10 })
  maxSizeMb: number;
}

export const RecruitmentFormFieldSchema =
  SchemaFactory.createForClass(RecruitmentFormField);

@Schema({ _id: false })
export class RecruitmentDownloadableFile {
  @Prop({ default: '' })
  url: string;

  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  type: string;

  @Prop({ default: 0 })
  size: number;
}

export const RecruitmentDownloadableFileSchema = SchemaFactory.createForClass(
  RecruitmentDownloadableFile,
);

@Schema({ timestamps: true, collection: 'recruitment_campaigns' })
export class RecruitmentCampaign {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  contentHtml: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ enum: RECRUITMENT_CAMPAIGN_STATUSES, default: 'published' })
  status: RecruitmentCampaignStatus;

  @Prop({ type: [RecruitmentFormFieldSchema], default: [] })
  formFields: RecruitmentFormField[];

  @Prop({ type: RecruitmentDownloadableFileSchema, default: null })
  downloadableFile?: RecruitmentDownloadableFile | null;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ default: '' })
  duplicatedFrom: string;
}

export const RecruitmentCampaignSchema =
  SchemaFactory.createForClass(RecruitmentCampaign);

RecruitmentCampaignSchema.index({ status: 1, startsAt: -1 });
RecruitmentCampaignSchema.index({ title: 'text', description: 'text' });
