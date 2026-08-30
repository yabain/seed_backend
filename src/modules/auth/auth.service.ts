import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Admin, AdminDocument } from './schemas/admin.schema';
import {
  TwoFactorCode,
  TwoFactorCodeDocument,
} from './schemas/two-factor-code.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import { LoginDto } from './dto/login.dto';
import { SendTwoFactorCodeDto } from './dto/send-two-factor-code.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { renderEmailLayout, escapeHtml } from '../mail/templates/layout';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SiteService } from '../site/site.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const MAX_TWO_FACTOR_ATTEMPTS = 5;

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly CODE_TTL_MS = 10 * 60 * 1000;
  private readonly TWO_FACTOR_DEDUP_MS = 30 * 1000;
  private readonly twoFactorChallengeLocks = new Map<string, Promise<boolean>>();

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(TwoFactorCode.name)
    private readonly twoFactorCodeModel: Model<TwoFactorCodeDocument>,
    @InjectModel(PasswordResetToken.name)
    private readonly passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditLogService: AuditLogService,
    private readonly siteService: SiteService,
  ) {}

  private emailBranding(orgName?: string) {
    return {
      logo: this.configService.get<string>('EMAIL_LOGO_URL')?.trim() || '',
      orgName: orgName?.trim() || 'Organisation',
      social: {
        facebook: this.configService.get<string>('EMAIL_SOCIAL_FACEBOOK')?.trim() || '',
        instagram: this.configService.get<string>('EMAIL_SOCIAL_INSTAGRAM')?.trim() || '',
        linkedin: this.configService.get<string>('EMAIL_SOCIAL_LINKEDIN')?.trim() || '',
        twitter: this.configService.get<string>('EMAIL_SOCIAL_TWITTER')?.trim() || '',
        youtube: this.configService.get<string>('EMAIL_SOCIAL_YOUTUBE')?.trim() || '',
      },
    };
  }

  async validateAdmin(
    email: string,
    password: string,
  ): Promise<AdminDocument | null> {
    const admin = await this.adminModel
      .findOne({ email: email.toLowerCase().trim() })
      .exec();
    if (!admin) {
      return null;
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      return null;
    }

    return admin;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async invalidatePreviousCodes(adminId: string): Promise<void> {
    await this.twoFactorCodeModel
      .updateMany(
        { adminId, used: false, expiresAt: { $gt: new Date() } },
        { used: true },
      )
      .exec();
  }

  private async createCode(adminId: string): Promise<string> {
    await this.invalidatePreviousCodes(adminId);
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.CODE_TTL_MS);
    await this.twoFactorCodeModel.create({
      adminId,
      code,
      used: false,
      expiresAt,
    });
    return code;
  }

  private async sendCodeEmail(to: string, code: string): Promise<boolean> {
    const siteConfig = await this.siteService.getPublicConfig();
    const orgName = siteConfig.orgName?.trim() || 'Organisation';
    const branding = this.emailBranding(siteConfig.orgName);

    const html = renderEmailLayout({
      title: 'Votre code de connexion',
      preheader: `Votre code de connexion ${orgName} est ${code}. Il expire dans 10 minutes.`,
      contentHtml: `
        <p style="margin:0 0 16px;">Voici votre code de connexion &agrave; la plateforme <strong>${escapeHtml(orgName)}</strong> :</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;">
          <tr>
            <td align="center" style="font-size:32px;letter-spacing:8px;font-weight:700;color:#0f172a;">
              ${escapeHtml(code)}
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#475569;font-size:14px;">
          Ce code est valable pendant <strong>10 minutes</strong>. Si vous n&rsquo;&ecirc;tes pas &agrave; l&rsquo;origine de cette demande, ignorez cet e-mail.
        </p>
      `,
      branding,
    });

    const sent = await this.mailService.send({
      to,
      subject: `Votre code de connexion ${orgName}`,
      html,
    });

    if (!sent) {
      this.logger.warn(`E-mail 2FA non envoyé à ${to}.`);
    }
    return sent;
  }

  /**
   * A double click or a browser retry can submit the login request twice.
   * Reuse the fresh challenge instead of issuing two codes and two e-mails.
   */
  private async issueLoginTwoFactorChallenge(admin: AdminDocument): Promise<boolean> {
    const adminId = admin._id.toString();
    const pending = this.twoFactorChallengeLocks.get(adminId);
    if (pending) {
      await pending;
      return false;
    }

    const task = (async () => {
      const recentCode = await this.twoFactorCodeModel
        .findOne({
          adminId,
          used: false,
          expiresAt: { $gt: new Date() },
          createdAt: { $gte: new Date(Date.now() - this.TWO_FACTOR_DEDUP_MS) },
        })
        .sort({ createdAt: -1 })
        .exec();
      if (recentCode) {
        return false;
      }

      const code = await this.createCode(adminId);
      const sent = await this.sendCodeEmail(admin.email, code);
      if (!sent) {
        await this.twoFactorCodeModel.updateOne({ adminId, code, used: false }, { used: true }).exec();
      }
      return sent;
    })();

    this.twoFactorChallengeLocks.set(adminId, task);
    void task.finally(() => {
      setTimeout(() => {
        if (this.twoFactorChallengeLocks.get(adminId) === task) {
          this.twoFactorChallengeLocks.delete(adminId);
        }
      }, this.TWO_FACTOR_DEDUP_MS);
    });
    return task;
  }

  async login(loginDto: LoginDto, ip?: string, userAgent?: string) {
    const admin = await this.adminModel
      .findOne({ email: loginDto.email.toLowerCase().trim() })
      .exec();

    if (!admin) {
      await this.auditLogService.record({
        action: 'auth.login_failed',
        resourceType: 'admin',
        metadata: { reason: 'user_not_found', email: loginDto.email },
        method: 'POST',
        path: '/admin/auth/login',
        statusCode: 401,
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!admin.isActive) {
      await this.auditLogService.record({
        actorId: String(admin._id),
        actorEmail: admin.email,
        action: 'auth.login_failed',
        resourceType: 'admin',
        resourceId: String(admin._id),
        metadata: { reason: 'account_disabled' },
        method: 'POST',
        path: '/admin/auth/login',
        statusCode: 401,
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    if (admin.lockoutUntil && new Date(admin.lockoutUntil) > new Date()) {
      await this.auditLogService.record({
        actorId: String(admin._id),
        actorEmail: admin.email,
        action: 'auth.login_blocked',
        resourceType: 'admin',
        resourceId: String(admin._id),
        metadata: {
          reason: 'temporary_lockout',
          lockoutUntil: admin.lockoutUntil,
        },
        method: 'POST',
        path: '/admin/auth/login',
        statusCode: 429,
        ip,
        userAgent,
      });
      throw new UnauthorizedException(
        'Compte temporairement verrouillé. Veuillez réessayer plus tard.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      admin.password,
    );
    if (!isPasswordValid) {
      const attempts = (admin.loginAttempts || 0) + 1;
      const lockoutUntil =
        attempts >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : null;

      await this.adminModel.findByIdAndUpdate(admin._id, {
        loginAttempts: attempts,
        lockoutUntil,
      });

      await this.auditLogService.record({
        actorId: String(admin._id),
        actorEmail: admin.email,
        action: 'auth.login_failed',
        resourceType: 'admin',
        resourceId: String(admin._id),
        metadata: {
          reason: 'wrong_password',
          attempt: attempts,
          maxAttempts: MAX_LOGIN_ATTEMPTS,
          ip,
          userAgent,
        },
        method: 'POST',
        path: '/admin/auth/login',
        statusCode: 401,
        ip,
        userAgent,
      });

      if (lockoutUntil) {
        void this.mailService
          .send({
            to: admin.email,
            subject: `🔒 Compte temporairement verrouillé — ${admin.email}`,
            html: `
              <p>Bonjour <strong>${escapeHtml(admin.name)}</strong>,</p>
              <p>Nous avons détecté <strong>${MAX_LOGIN_ATTEMPTS} tentatives de connexion échouées</strong> sur votre compte.</p>
              <p>Pour votre sécurité, votre compte a été temporairement verrouillé jusqu'au <strong>${lockoutUntil.toLocaleString('fr-FR')}</strong> (${LOCKOUT_DURATION_MS / 60000} minutes).</p>
              <p>Si vous n'êtes pas à l'origine de ces tentatives, nous vous recommandons de contacter un administrateur.</p>
            `,
          })
          .catch((error) =>
            this.logger.warn('Send lockout email failed:', error),
          );
      }

      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.adminModel.findByIdAndUpdate(admin._id, {
      loginAttempts: 0,
      lockoutUntil: null,
    });

    const codeSent = await this.issueLoginTwoFactorChallenge(admin);

    await this.auditLogService.record({
      actorId: String(admin._id),
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'auth.two_factor_challenge_sent',
      resourceType: 'admin',
      resourceId: String(admin._id),
      metadata: { via: 'login', ip, codeSent },
      method: 'POST',
      path: '/admin/auth/login',
      statusCode: 200,
      ip,
      userAgent,
    });

    return {
      requiresTwoFactor: true,
      email: admin.email,
      message: 'Un code de vérification a été envoyé à votre adresse e-mail.',
    };
  }

  async sendTwoFactorCode(
    sendTwoFactorCodeDto: SendTwoFactorCodeDto,
    ip?: string,
    userAgent?: string,
  ) {
    const admin = await this.adminModel
      .findOne({ email: sendTwoFactorCodeDto.email.toLowerCase().trim() })
      .exec();

    if (!admin || !admin.isActive) {
      await this.auditLogService.record({
        action: 'auth.login_failed',
        resourceType: 'admin',
        metadata: {
          reason: 'user_not_found',
          email: sendTwoFactorCodeDto.email,
        },
        method: 'POST',
        path: '/admin/auth/2fa/send-code',
        statusCode: 400,
        ip,
        userAgent,
      });
      throw new BadRequestException(
        'Aucun compte actif associé à cette adresse e-mail.',
      );
    }

    const code = await this.createCode(admin._id.toString());
    await this.sendCodeEmail(admin.email, code);

    await this.auditLogService.record({
      actorId: String(admin._id),
      actorEmail: admin.email,
      action: 'auth.two_factor_challenge_sent',
      resourceType: 'admin',
      resourceId: String(admin._id),
      metadata: { via: 'resend', ip },
      method: 'POST',
      path: '/admin/auth/2fa/send-code',
      statusCode: 200,
      ip,
      userAgent,
    });

    return {
      success: true,
      message: 'Un nouveau code de vérification a été envoyé.',
    };
  }

  async verifyTwoFactor(
    verifyTwoFactorDto: VerifyTwoFactorDto,
    ip?: string,
    userAgent?: string,
  ) {
    const admin = await this.adminModel
      .findOne({ email: verifyTwoFactorDto.email.toLowerCase().trim() })
      .exec();

    if (!admin || !admin.isActive) {
      await this.auditLogService.record({
        action: 'auth.login_failed',
        resourceType: 'admin',
        metadata: { reason: 'user_not_found', email: verifyTwoFactorDto.email },
        method: 'POST',
        path: '/admin/auth/2fa/verify',
        statusCode: 401,
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    const codeRecord = await this.twoFactorCodeModel
      .findOne({
        adminId: admin._id.toString(),
        code: verifyTwoFactorDto.code,
        used: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!codeRecord) {
      const attempts = (admin.twoFactorAttempts || 0) + 1;
      await this.adminModel.findByIdAndUpdate(admin._id, {
        twoFactorAttempts: attempts,
      });

      await this.auditLogService.record({
        actorId: String(admin._id),
        actorEmail: admin.email,
        action: 'auth.two_factor_failed',
        resourceType: 'admin',
        resourceId: String(admin._id),
        metadata: {
          reason: 'invalid_code',
          attempt: attempts,
          maxAttempts: MAX_TWO_FACTOR_ATTEMPTS,
        },
        method: 'POST',
        path: '/admin/auth/2fa/verify',
        statusCode: 401,
        ip,
        userAgent,
      });

      if (attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
        await this.adminModel.findByIdAndUpdate(admin._id, {
          twoFactorCode: '',
          twoFactorCodeExpiresAt: null,
          twoFactorAttempts: 0,
          loginAttempts: 0,
          lockoutUntil: null,
        });

        await this.auditLogService.record({
          actorId: String(admin._id),
          actorEmail: admin.email,
          action: 'auth.two_factor_blocked',
          resourceType: 'admin',
          resourceId: String(admin._id),
          metadata: {
            reason: 'max_attempts',
            maxAttempts: MAX_TWO_FACTOR_ATTEMPTS,
          },
          method: 'POST',
          path: '/admin/auth/2fa/verify',
          statusCode: 429,
          ip,
          userAgent,
        });

        throw new UnauthorizedException(
          'Trop de tentatives. Veuillez vous reconnecter.',
        );
      }

      throw new UnauthorizedException(
        'Code de vérification invalide ou expiré.',
      );
    }

    codeRecord.used = true;
    await codeRecord.save();

    await this.adminModel.findByIdAndUpdate(admin._id, {
      lastLoginAt: new Date(),
      twoFactorCode: '',
      twoFactorCodeExpiresAt: null,
      twoFactorAttempts: 0,
      loginAttempts: 0,
      lockoutUntil: null,
    });

    const payload = {
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    };

    await this.auditLogService.record({
      actorId: String(admin._id),
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'auth.login',
      resourceType: 'admin',
      resourceId: String(admin._id),
      resourceLabel: admin.email,
      method: 'POST',
      path: '/admin/auth/2fa/verify',
      statusCode: 200,
      ip,
      userAgent,
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar || undefined,
      },
    };
  }

  async getProfile(adminId: string) {
    const admin = await this.adminModel.findById(adminId).exec();
    if (!admin) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }
    const createdAt =
      (admin as unknown as { createdAt?: Date }).createdAt ?? new Date(0);
    return {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone || undefined,
      avatar: admin.avatar || undefined,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt?.toISOString(),
      createdAt: createdAt.toISOString(),
    };
  }

  async updateProfile(
    adminId: string,
    data: { name?: string; phone?: string; avatar?: string },
  ) {
    const admin = await this.adminModel.findById(adminId).exec();
    if (!admin) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    if (data.name !== undefined) {
      admin.name = data.name.trim();
    }
    if (data.phone !== undefined) {
      admin.phone = data.phone?.trim() || undefined;
    }
    if (data.avatar !== undefined) {
      admin.avatar = data.avatar?.trim() || undefined;
    }

    await admin.save();

    const createdAt =
      (admin as unknown as { createdAt?: Date }).createdAt ?? new Date(0);

    return {
      updated: true,
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        phone: admin.phone || undefined,
        avatar: admin.avatar || undefined,
        role: admin.role,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt?.toISOString(),
        createdAt: createdAt.toISOString(),
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async invalidatePreviousResetTokens(adminId: string): Promise<void> {
    await this.passwordResetTokenModel
      .updateMany(
        { adminId, used: false, expiresAt: { $gt: new Date() } },
        { used: true },
      )
      .exec();
  }

  private buildFrontendUrl(): string {
    const explicit = this.configService.get<string>('FRONTEND_URL');
    if (explicit) {
      return explicit.replace(/\/+$/, '');
    }
    const clientOrigin = this.configService
      .get<string>('CLIENT_ORIGIN')
      ?.split(',')[0]
      ?.trim();
    return (clientOrigin || 'http://localhost:4200').replace(/\/+$/, '');
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    ip?: string,
    userAgent?: string,
  ) {
    const genericResponse = {
      success: true,
      message:
        'Si un compte actif existe pour cette adresse, un e-mail contenant un lien de réinitialisation vient d’être envoyé.',
    };

    const admin = await this.adminModel
      .findOne({ email: forgotPasswordDto.email.toLowerCase().trim() })
      .exec();

    if (!admin || !admin.isActive) {
      await this.auditLogService.record({
        action: 'auth.password_reset_requested',
        resourceType: 'admin',
        metadata: { reason: 'user_not_found_or_inactive' },
        method: 'POST',
        path: '/admin/auth/forgot-password',
        statusCode: 200,
        ip,
        userAgent,
      });
      return genericResponse;
    }

    await this.invalidatePreviousResetTokens(admin._id.toString());

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.passwordResetTokenModel.create({
      adminId: admin._id.toString(),
      tokenHash: this.hashToken(token),
      used: false,
      expiresAt,
    });

    const resetUrl = `${this.buildFrontendUrl()}/admin/reset-password?token=${token}`;

    const siteConfig = await this.siteService.getPublicConfig();
    const orgName = siteConfig.orgName?.trim() || 'Organisation';
    const branding = this.emailBranding(siteConfig.orgName);

    const html = renderEmailLayout({
      title: 'Réinitialisation de votre mot de passe',
      preheader:
        'Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.',
      contentHtml: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(admin.name)}</strong>,</p>
        <p style="margin:0 0 16px;">Vous avez demandé la réinitialisation du mot de passe de votre compte sur la plateforme <strong>${escapeHtml(orgName)}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
          <tr>
            <td align="center" style="background:#0f766e;border-radius:8px;padding:14px 24px;">
              <a href="${escapeHtml(resetUrl)}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px;color:#475569;font-size:14px;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur&nbsp;:
        </p>
        <p style="margin:0 0 16px;word-break:break-all;color:#0f766e;font-size:13px;">
          ${escapeHtml(resetUrl)}
        </p>
        <p style="margin:0;color:#475569;font-size:14px;">
          Ce lien est valable pendant <strong>1 heure</strong>. Si vous n&rsquo;&ecirc;tes pas &agrave; l&rsquo;origine de cette demande, ignorez cet e-mail : votre mot de passe restera inchangé.
        </p>
      `,
      branding,
    });

    const sent = await this.mailService.send({
      to: admin.email,
      subject: `Réinitialisation de votre mot de passe — ${orgName}`,
      html,
    });

    if (!sent) {
      this.logger.warn(
        `E-mail de réinitialisation non envoyé à ${admin.email}.`,
      );
    }

    await this.auditLogService.record({
      actorId: String(admin._id),
      actorEmail: admin.email,
      action: 'auth.password_reset_requested',
      resourceType: 'admin',
      resourceId: String(admin._id),
      metadata: { emailSent: sent, ip },
      method: 'POST',
      path: '/admin/auth/forgot-password',
      statusCode: 200,
      ip,
      userAgent,
    });

    return genericResponse;
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    ip?: string,
    userAgent?: string,
  ) {
    const tokenHash = this.hashToken(resetPasswordDto.token);

    const record = await this.passwordResetTokenModel
      .findOne({
        tokenHash,
        used: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!record) {
      await this.auditLogService.record({
        action: 'auth.password_reset_failed',
        resourceType: 'admin',
        metadata: { reason: 'invalid_or_expired_token' },
        method: 'POST',
        path: '/admin/auth/reset-password',
        statusCode: 400,
        ip,
        userAgent,
      });
      throw new BadRequestException(
        'Ce lien de réinitialisation est invalide ou a expiré. Veuillez faire une nouvelle demande.',
      );
    }

    const admin = await this.adminModel.findById(record.adminId).exec();

    if (!admin || !admin.isActive) {
      record.used = true;
      await record.save();

      await this.auditLogService.record({
        action: 'auth.password_reset_failed',
        resourceType: 'admin',
        metadata: { reason: 'user_not_found_or_inactive' },
        method: 'POST',
        path: '/admin/auth/reset-password',
        statusCode: 400,
        ip,
        userAgent,
      });
      throw new BadRequestException(
        'Ce lien de réinitialisation est invalide ou a expiré. Veuillez faire une nouvelle demande.',
      );
    }

    const hashed = await bcrypt.hash(resetPasswordDto.password, 10);

    await this.adminModel.findByIdAndUpdate(admin._id, {
      password: hashed,
      loginAttempts: 0,
      lockoutUntil: null,
      twoFactorAttempts: 0,
    });

    await this.invalidatePreviousResetTokens(admin._id.toString());
    record.used = true;
    await record.save();

    const siteConfig = await this.siteService.getPublicConfig();
    const orgName = siteConfig.orgName?.trim() || 'Organisation';
    const branding = this.emailBranding(siteConfig.orgName);

    const html = renderEmailLayout({
      title: 'Votre mot de passe a été modifié',
      preheader: `Confirmation de la modification de votre mot de passe ${orgName}.`,
      contentHtml: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(admin.name)}</strong>,</p>
        <p style="margin:0 0 16px;">
          Votre mot de passe vient d&rsquo;&ecirc;tre modifié avec succès. Vous pouvez dès à présent vous connecter avec vos nouveaux identifiants.
        </p>
        <p style="margin:0;color:#475569;font-size:14px;">
          Si vous n&rsquo;&ecirc;tes pas &agrave; l&rsquo;origine de cette modification, contactez immédiatement un administrateur de la plateforme.
        </p>
      `,
      branding,
    });

    void this.mailService
      .send({
        to: admin.email,
        subject: `🔒 Votre mot de passe a été modifié — ${orgName}`,
        html,
      })
      .catch((error) =>
        this.logger.warn('Send password-changed email failed:', error),
      );

    await this.auditLogService.record({
      actorId: String(admin._id),
      actorEmail: admin.email,
      action: 'auth.password_reset_completed',
      resourceType: 'admin',
      resourceId: String(admin._id),
      resourceLabel: admin.email,
      method: 'POST',
      path: '/admin/auth/reset-password',
      statusCode: 200,
      ip,
      userAgent,
    });

    return {
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès.',
    };
  }
}
