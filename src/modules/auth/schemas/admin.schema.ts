import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

export const USER_ROLES = [
  'user',
  'consultant',
  'admin',
  'superadmin',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Hiérarchie permettant de comparer les rôles (superadmin > admin > ...).
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  user: 1,
  consultant: 2,
  admin: 3,
  superadmin: 4,
};

@Schema({
  timestamps: true,
  collection: 'admins',
})
export class Admin {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ trim: true })
  name: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  avatar?: string;

  @Prop({
    enum: USER_ROLES,
    default: 'user',
  })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  notifyContact: boolean;

  @Prop()
  lastLoginAt: Date;

  @Prop({ default: 0 })
  loginAttempts: number;

  @Prop({ type: Date, default: null })
  lockoutUntil: Date | null;

  @Prop({ type: Date, default: null })
  sessionInvalidatedAt: Date | null;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop()
  twoFactorCode: string;

  @Prop({ type: Date, default: null })
  twoFactorCodeExpiresAt: Date | null;

  @Prop({ default: 0 })
  twoFactorAttempts: number;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
