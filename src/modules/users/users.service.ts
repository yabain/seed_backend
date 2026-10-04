import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SiteService } from '../site/site.service';
import { accountCredentialsTemplate } from '../mail/templates/account.templates';
import {
  emailSocialFromSiteConfig,
  emailLogoFromSiteConfig,
} from '../../common/utils/email-social.util';

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Utilisateur',
  consultant: 'Consultant',
  admin: 'Administrateur',
  superadmin: 'Super administrateur',
};

/** Agrège les parties du nom en un nom complet lisible. */
function fullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
): string {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }
  return fallback?.trim() ?? '';
}

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
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    avatar?: string;
    role: UserRole;
    isActive: boolean;
    notifyContact: boolean;
    notifyWhatsapp: boolean;
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
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  notifyContact: boolean;
  notifyWhatsapp: boolean;
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
    private readonly whatsappService: WhatsappService,
  ) {}

  private sanitize(admin: Record<string, unknown>): SanitizedAdmin {
    const { _id, ...rest } = admin;
    const withoutPassword = { ...rest };
    delete withoutPassword.password;
    const firstName = withoutPassword.firstName as string | undefined;
    const lastName = withoutPassword.lastName as string | undefined;
    return {
      id: String(_id),
      name: fullName(
        firstName,
        lastName,
        (withoutPassword.name as string) ?? '',
      ),
      firstName,
      lastName,
      email: (withoutPassword.email as string) ?? '',
      phone: withoutPassword.phone as string | undefined,
      avatar: (withoutPassword.avatar as string | undefined) || undefined,
      role: (withoutPassword.role as UserRole) ?? 'user',
      isActive: (withoutPassword.isActive as boolean) ?? true,
      notifyContact: (withoutPassword.notifyContact as boolean) ?? true,
      notifyWhatsapp: (withoutPassword.notifyWhatsapp as boolean) ?? true,
      lastLoginAt:
        (withoutPassword.lastLoginAt as string | undefined) ?? undefined,
      createdAt:
        (withoutPassword.createdAt as string) ?? new Date().toISOString(),
    };
  }

  /**
   * Réservé au super administrateur : une action qui touche un compte super
   * administrateur (création, modification, mot de passe, statut, suppression)
   * est refusée pour tout autre rôle. Un acteur sans rôle (appel interne)
   * est autorisé à passer.
   */
  private requireSuperadmin(
    actor: UserActor | undefined,
    reason: string,
  ): void {
    if (actor && actor.role !== 'superadmin') {
      throw new ForbiddenException(
        `Action réservée au super administrateur : ${reason}.`,
      );
    }
  }

  private async assertTargetAccountRole(id: string): Promise<UserRole> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }
    const target = await this.adminModel.findById(id).lean().exec();
    if (!target) {
      throw new NotFoundException('Compte introuvable');
    }
    return target.role ?? 'user';
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
        { firstName: { $regex: trimmedSearch, $options: 'i' } },
        { lastName: { $regex: trimmedSearch, $options: 'i' } },
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
    if (dto.role === 'superadmin') {
      this.requireSuperadmin(actor, 'créer un compte super administrateur');
    }

    const existing = await this.adminModel
      .findOne({ email: dto.email.toLowerCase().trim() })
      .exec();
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const firstName = dto.firstName?.trim() ?? '';
    const lastName = dto.lastName?.trim() ?? '';
    const created = await this.adminModel.create({
      firstName,
      lastName,
      name: fullName(firstName, lastName, dto.name) || firstName,
      email: dto.email.toLowerCase().trim(),
      password: hashed,
      phone: dto.phone ?? '',
      role: dto.role ?? 'user',
      isActive: dto.isActive ?? true,
      notifyContact: dto.notifyContact ?? true,
      notifyWhatsapp: dto.notifyWhatsapp ?? true,
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
        created as AdminDocument,
        dto.password,
        dto.role ?? 'user',
        dto.siteUrl,
      );
    }

    return sanitized;
  }

  private async sendCredentialsEmail(
    admin: AdminDocument,
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
        to: admin.email,
        subject: `Votre compte ${siteConfig.orgName || 'Organisation'} — identifiants de connexion`,
        html: accountCredentialsTemplate({
          name: admin.name,
          email: admin.email,
          password,
          roleLabel: ROLE_LABELS[role] ?? role,
          loginUrl: `${frontUrl}/admin/login`,
          siteLink: frontUrl,
          colors: {
            primary: siteConfig.primaryColor,
            secondary: siteConfig.secondaryColor,
          },
          branding: {
            logo: emailLogoFromSiteConfig(siteConfig, this.configService),
            orgName: siteConfig.orgName,
            social: emailSocialFromSiteConfig(siteConfig, this.configService),
          },
        }),
      });
      if (!sent) {
        this.logger.warn(
          `Identifiants non envoyés à ${admin.email} : SMTP non configuré.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi des identifiants à ${admin.email} :`,
        error,
      );
    }

    if (admin.phone && admin.notifyWhatsapp !== false) {
      try {
        const siteConfig = await this.siteService.getPublicConfig();
        const orgName = siteConfig.orgName?.trim() || 'Organisation';
        const frontUrl =
          (siteUrl ?? '').trim().replace(/\/$/, '') ||
          this.configService.get<string>('FRONT_URL') ||
          'http://localhost:4200';
        await this.whatsappService.sendText(
          admin.phone,
          `🆕 ${orgName} — Vos identifiants de connexion\n\nBonjour ${admin.name},\n\nVotre compte a été créé. Voici vos identifiants pour vous connecter :\n\nE-mail : ${admin.email}\nMot de passe : ${password}\n\nConnectez-vous ici : ${frontUrl}/admin/login\n\nPour des raisons de sécurité, pensez à changer ce mot de passe lors de votre première connexion.`,
        );
      } catch (error) {
        this.logger.warn(
          `Identifiants WhatsApp non envoyés à ${admin.phone} : ${(error as Error)?.message || error}`,
        );
      }
    }
  }

  async update(id: string, dto: UpdateUserDto, actor?: UserActor) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Compte introuvable');
    }

    const targetRole = await this.assertTargetAccountRole(id);
    if (targetRole === 'superadmin' || dto.role === 'superadmin') {
      this.requireSuperadmin(actor, 'gérer un compte super administrateur');
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
    // Recompose `name` à partir des parties mises à jour.
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const current = await this.adminModel.findById(id).lean().exec();
      const firstName = dto.firstName?.trim() ?? current?.firstName ?? '';
      const lastName = dto.lastName?.trim() ?? current?.lastName ?? '';
      updateData.firstName = firstName;
      updateData.lastName = lastName;
      updateData.name =
        fullName(firstName, lastName, current?.name ?? undefined) ||
        (dto.name?.trim() ?? '');
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

    const targetRole = await this.assertTargetAccountRole(id);
    if (targetRole === 'superadmin') {
      this.requireSuperadmin(
        actor,
        'réinitialiser le mot de passe d’un compte super administrateur',
      );
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
    const targetRole = await this.assertTargetAccountRole(id);
    if (targetRole === 'superadmin') {
      this.requireSuperadmin(actor, 'supprimer un compte super administrateur');
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

    const targetRole = admin.role ?? 'user';
    if (targetRole === 'superadmin') {
      this.requireSuperadmin(
        actor,
        'modifier le statut d’un compte super administrateur',
      );
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
