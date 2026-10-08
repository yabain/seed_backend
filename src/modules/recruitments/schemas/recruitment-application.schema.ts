import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RecruitmentApplicationDocument =
  HydratedDocument<RecruitmentApplication>;

export const RECRUITMENT_APPLICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;
export type RecruitmentApplicationStatus =
  (typeof RECRUITMENT_APPLICATION_STATUSES)[number];

@Schema({ _id: false })
export class RecruitmentApplicationFieldValue {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, trim: true })
  type: string;

  @Prop({ default: '' })
  value: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: '' })
  fileType: string;

  @Prop({ default: 0 })
  fileSize: number;
}

export const RecruitmentApplicationFieldValueSchema =
  SchemaFactory.createForClass(RecruitmentApplicationFieldValue);

@Schema({ timestamps: true, collection: 'recruitment_applications' })
export class RecruitmentApplication {
  @Prop({ required: true, trim: true })
  campaignId: string;

  @Prop({ required: true, trim: true })
  campaignTitle: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ default: '' })
  firstName: string;

  @Prop({ default: '' })
  lastName: string;

  @Prop({ required: true, default: '' })
  phone: string;

  @Prop({
    enum: RECRUITMENT_APPLICATION_STATUSES,
    default: 'pending',
  })
  status: RecruitmentApplicationStatus;

  @Prop({ type: [RecruitmentApplicationFieldValueSchema], default: [] })
  fields: RecruitmentApplicationFieldValue[];

  @Prop({ default: '' })
  reviewedBy: string;

  @Prop({ default: '' })
  reviewedByRole: string;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;

  @Prop({ default: '' })
  reviewNote: string;
}

export const RecruitmentApplicationSchema =
  SchemaFactory.createForClass(RecruitmentApplication);

RecruitmentApplicationSchema.index({ campaignId: 1, email: 1 }, { unique: true });
RecruitmentApplicationSchema.index({ campaignId: 1, status: 1, createdAt: 1 });
