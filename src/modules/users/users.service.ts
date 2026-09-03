import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, isValidObjectId } from 'mongoose';
import {
  Admin,
  AdminDocument,
  ROLE_LEVEL,
  UserRole,
} from '../auth/schemas/admin.schema';
import { UserLog, UserLogDocument } from './schemas/user-log.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from '../mail/mail.service';
import { SiteService } from '../site/site.service';
import { accountCredentialsTemplate } from '../mail/templates/account.templates';
import { emailSocialFromEnv } from '../../common/utils/email-social.util';

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Utilisateur',
  consultant: 'Consultant',
  admin: 'Administrateur',
  superadmin: 'Super administrateur',
};

export interface UserActor {
  id: string;
  email?: string;
  role?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  consultants: number;
  users: number;
}

export interface UsersListMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface UsersListResult {
  data: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    role: UserRole;
    isActive: boolean;
    notifyContact: boolean;
    lastLoginAt?: string;
    createdAt: string;
  }>;
  meta: UsersListMeta;
  stats: UserStats;
}

export interface UserLogEntry {
  id: string;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SanitizedAdmin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  notifyContact: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(UserLog.name)
    private readonly userLogModel: Model<UserLogDocument>,
    private readonly mailService: MailService,
    private readonly siteService: SiteService,
    private readonly configService: ConfigService,
  ) {}

  private sanitize(admin: Record<string, unknown>): SanitizedAdmin {
    const { _id, ...rest } = admin;
    const withoutPassword = { ...rest };
    delete withoutPassword.password;
    return {
      id: String(_id),
      name: (withoutPassword.name as string) ?? '',
      email: (withoutPassword.email as string) ?? '',
      phone: withoutPassword.phone as string | undefined,
      avatar: (withoutPassword.avatar as string | undefined) || undefined,
      role: (withoutPassword.role as UserRole) ?? 'user',
      isActive: (withoutPassword.isActive as boolean) ?? true,
      notifyContact: (withoutPassword.notifyContact as boolean) ?? true,
      lastLoginAt:
        (withoutPassword.lastLoginAt as string | undefined) ?? undefined,
      createdAt:
        (withoutPassword.createdAt as string) ?? new Date().toISOString(),
    };
  }

  async getStats(): Promise<UserStats> {
    const [total, active, admins, consultants] = await Promise.all([
      this.adminModel.countDocuments(),
      this.adminModel.countDocuments({ isActive: true }),
      this.adminModel.countDocuments({
        role: { $in: ['admin', 'superadmin'] },
      }),
      this.adminModel.countDocuments({ role: 'consultant' }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      admins,
      consultants,
      users: total - admins - consultants,
    };
  }

  async getUsersList(
    page: number,
    limit: number,
    search?: string,
    status?: string,
  ): Promise<UsersListResult> {
    const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, Number(limit)))
      : 10;
    const skip = (safePage - 1) * safeLimit;

    const filter: Record<string, unknown> = {};
    const trimmedSearch = (search ?? '').trim();

    if (trimmedSearch) {
      filter.$or = [
        { name: { $regex: trimmedSearch, $options: 'i' } },
        { email: { $regex: trimmedSearch, $options: 'i' } },
      ];
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'admin') {
      filter.role = { $in: ['admin', 'superadmin'] };
    } else if (status === 'consultant') {
      filter.role = 'consultant';
    } else if (status === 'user') {
      filter.role = 'user';
    }

    const [totalItems, users] = await Promise.all([
      this.adminModel.countDocuments(filter),
      this.adminModel
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
    ]);

    const stats = await this.getStats();

    return {
      data: users.map((user) => this.sanitize(user)),
      meta: {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / safeLimit)),
        currentPage: safePage,
        limit: safeLimit,
        hasNextPage: safePage * safeLimit < totalItems,
        hasPrevPage: safePage > 1,
      },
      stats,
    };
  }

  async findOne(id: string): Promise<SanitizedAdmin> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }
    const admin = await this.adminModel.findById(id).lean().exec();
    if (!admin) {
      throw new NotFoundException('Compte introuvable');
    }
    return this.sanitize(admin);
  }

  async getUserLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: UserLogEntry[]; meta: UsersListMeta }> {
    if (!isValidObjectId(userId)) {
      throw new NotFoundException('Compte introuvable');
    }

    const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, Number(limit)))
      : 20;
    const skip = (safePage - 1) * safeLimit;

    const [totalItems, logs] = await Promise.all([
      this.userLogModel.countDocuments({ userId }),
      this.userLogModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
    ]);

    return {
      data: logs.map((log) => {
        const raw = log as Record<string, unknown>;
        return {
          id: String(log._id),
          action: log.action,
          metadata: log.metadata,
          ip: log.ip,
          userAgent: log.userAgent,
          createdAt:
            raw.createdAt instanceof Date
              ? raw.createdAt.toISOString()
              : new Date().toISOString(),
        };
      }),
      meta: {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / safeLimit)),
        currentPage: safePage,
        limit: safeLimit,
        hasNextPage: safePage * safeLimit < totalItems,
        hasPrevPage: safePage > 1,
      },
    };
  }

  async recordLog(params: {
    actorId: string;
    actorEmail?: string;
    actorRole?: string;
    action: string;
    userId: string;
    userEmail?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.userLogModel.create({
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        metadata: params.metadata,
        ip: params.ip,
        userAgent: params.userAgent,
      });
    } catch {
      // ignore logging failures
    }
  }

  async create(dto: CreateUserDto, actor?: UserActor) {
    const existing = await this.adminModel
      .findOne({ email: dto.email.toLowerCase().trim() })
      .exec();
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.adminModel.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      password: hashed,
      phone: dto.phone ?? '',
      role: dto.role ?? 'user',
      isActive: dto.isActive ?? true,
      notifyContact: dto.notifyContact ?? true,
    });

    const sanitized = this.sanitize(
      (created.toObject ? created.toObject() : created) as unknown as Record<
        string,
        unknown
      >,
    );

    if (actor) {
      void this.recordLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'user.created',
        userId: sanitized.id,
        userEmail: sanitized.email,
        metadata: {
          role: sanitized.role,
          isActive: sanitized.isActive,
          credentialsSent: Boolean(dto.notifyContact),
        },
      });
    }

    if (dto.notifyContact && dto.isActive !== false) {
      await this.sendCredentialsEmail(
        sanitized.name,
        sanitized.email,
        dto.password,
        (dto.role ?? 'user') as UserRole,
        dto.siteUrl,
      );
    }

    return sanitized;
  }

  private async sendCredentialsEmail(
    name: string,
    email: string,
    password: string,
    role: UserRole,
    siteUrl?: string,
  ): Promise<void> {
    try {
      const siteConfig = await this.siteService.getPublicConfig();
      const frontUrl =
        (siteUrl ?? '').trim().replace(/\/$/, '') ||
        this.configService.get<string>('FRONT_URL') ||
        'http://localhost:4200';
      const sent = await this.mailService.send({
        to: email,
        subject: `Votre compte ${siteConfig.orgName || 'Organisation'} — identifiants de connexion`,
        html: accountCredentialsTemplate({
          name,
          email,
          password,
          roleLabel: ROLE_LABELS[role] ?? role,
          loginUrl: `${frontUrl}/admin/login`,
          siteLink: frontUrl,
          colors: {
            primary: siteConfig.primaryColor,
            secondary: siteConfig.secondaryColor,
          },
          branding: {
            logo:
              this.configService.get<string>('EMAIL_LOGO_URL')?.trim() || '',
            orgName: siteConfig.orgName,
            social: emailSocialFromEnv(this.configService),
          },
        }),
      });
      if (!sent) {
        this.logger.warn(
          `Identifiants non envoyés à ${email} : SMTP non configuré.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi des identifiants à ${email} :`,
        error,
      );
    }
  }

  async update(id: string, dto: UpdateUserDto, actor?: UserActor) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.email) {
      updateData.email = dto.email.toLowerCase().trim();
      const conflicting = await this.adminModel
        .findOne({ email: updateData.email })
        .exec();
      if (conflicting && String(conflicting._id) !== id) {
        throw new ConflictException('Un compte existe déjà avec cet e-mail.');
      }
    }
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const admin = await this.adminModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean()
      .exec();
    if (!admin) {
      throw new NotFoundException('Compte introuvable');
    }

    const sanitized = this.sanitize(admin);

    if (actor) {
      const changedFields = Object.keys(dto).filter(
        (key) => key !== 'password',
      );
      void this.recordLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'user.updated',
        userId: id,
        userEmail: sanitized.email,
        metadata: { changedFields },
      });
    }

    return sanitized;
  }

  async changePassword(id: string, dto: ChangePasswordDto, actor?: UserActor) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const admin = await this.adminModel
      .findByIdAndUpdate(id, { password: hashed }, { new: true })
      .lean()
      .exec();
    if (!admin) {
      throw new NotFoundException('Compte introuvable');
    }

    if (actor) {
      void this.recordLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'user.password_changed',
        userId: id,
        userEmail: (admin as unknown as Record<string, unknown>)
          .email as string,
      });
    }

    return { updated: true };
  }

  async remove(id: string, currentUserId: string, actor?: UserActor) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }
    if (id === currentUserId) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }
    const result = await this.adminModel.findByIdAndDelete(id).lean().exec();
    if (!result) {
      throw new NotFoundException('Compte introuvable');
    }

    if (actor) {
      void this.recordLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'user.deleted',
        userId: id,
        userEmail: (result as unknown as Record<string, unknown>)
          .email as string,
      });
    }

    return { deleted: true };
  }

  async toggleActive(id: string, isActive: boolean, actor?: UserActor) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }
    const admin = await this.adminModel.findById(id).lean().exec();
    if (!admin) {
      throw new NotFoundException('Compte introuvable');
    }

    await this.adminModel.findByIdAndUpdate(id, { isActive }).exec();

    const sanitized = this.sanitize(admin);

    if (actor) {
      void this.recordLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: isActive ? 'user.activated' : 'user.deactivated',
        userId: id,
        userEmail: (admin as unknown as Record<string, unknown>)
          .email as string,
        metadata: { isActive },
      });
    }

    return sanitized;
  }

  async protectSelfDemotion(
    currentUserId: string,
    targetId: string,
    newRole?: UserRole,
  ) {
    if (currentUserId !== targetId || !newRole) {
      return;
    }
    const current = await this.adminModel.findById(currentUserId).lean().exec();
    if (current && ROLE_LEVEL[current.role] > ROLE_LEVEL[newRole]) {
      throw new BadRequestException(
        'Vous ne pouvez pas réduire votre propre niveau d’accès.',
      );
    }
  }
}
