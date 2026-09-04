import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SmtpService } from '../smtp/smtp.service';
import { EmailLog, EmailLogDocument } from './email.schema';

export interface EmailStats {
  month: string;
  success: number;
  failed: number;
}

export interface EmailListMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  success: number;
  failed: number;
}

export interface EmailListResult {
  data: Array<{
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    status: boolean;
    category: 'single' | 'announcement';
    groupId?: string;
    sentCount: number;
    totalCount: number;
    createdAt: string;
  }>;
  meta: EmailListMeta;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectModel(EmailLog.name)
    private readonly emailModel: Model<EmailLogDocument>,
    private readonly smtpService: SmtpService,
    private readonly configService: ConfigService,
  ) {}

  private async buildTransporter(): Promise<nodemailer.Transporter> {
    const config = await this.smtpService.getSmtpData();
    if (!config || !config.status) {
      throw new BadRequestException(
        'La configuration SMTP est manquante ou désactivée.',
      );
    }
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort) || 587,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    const transporter = await this.buildTransporter();

    const from =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      'no-reply@example.org';

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      await this.saveMail({
        from,
        to,
        subject,
        body: html,
        status: true,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.saveMail({
        from,
        to,
        subject,
        body: html,
        status: false,
      });
      this.logger.error(`Failed to send email to ${to}: ${errorMessage}`);
      throw new BadRequestException(
        `Échec de l'envoi de l'e-mail : ${errorMessage}`,
      );
    }
  }

  async sendTestMail(
    to: string,
    subject: string,
    message: string,
  ): Promise<boolean> {
    const html = `
      <p>Ceci est un e-mail de test envoyé depuis la plateforme.</p>
      <p><strong>Sujet :</strong> ${subject ?? ''}</p>
      <p><strong>Message :</strong></p>
      <p>${(message ?? '').replace(/\n/g, '<br/>')}</p>
    `;
    return this.sendMail(to, subject, html);
  }

  private async saveMail(data: {
    from: string;
    to: string;
    subject: string;
    body: string;
    status: boolean;
  }): Promise<void> {
    try {
      await this.emailModel.create({
        from: data.from,
        to: data.to,
        subject: data.subject,
        body: data.body,
        status: data.status,
      });
    } catch (error) {
      this.logger.error('Failed to save email log', error as Error);
    }
  }

  async getOutputMails(
    page: number,
    keyword?: string,
    limit?: number,
  ): Promise<EmailListResult> {
    const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const safeLimit = [10, 25, 50, 100].includes(Number(limit))
      ? Number(limit)
      : 10;
    const skip = (safePage - 1) * safeLimit;

    const filter: Record<string, unknown> = {};
    const trimmedKeyword = (keyword ?? '').trim();
    if (trimmedKeyword) {
      filter.$or = [
        { to: { $regex: trimmedKeyword, $options: 'i' } },
        { subject: { $regex: trimmedKeyword, $options: 'i' } },
      ];
    }

    const [totalItems, emails] = await Promise.all([
      this.emailModel.countDocuments(filter),
      this.emailModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
    const successCount = await this.emailModel.countDocuments({ status: true });
    const failedCount = await this.emailModel.countDocuments({ status: false });

    const sanitizedEmails = emails.map((email) => {
      const raw = email as unknown as Record<string, unknown>;
      return {
        id: String(raw._id),
        from: (raw.from as string) || '',
        to: (raw.to as string) || '',
        subject: (raw.subject as string) || '',
        body: (raw.body as string) || '',
        status: (raw.status as boolean) || false,
        category: (raw.category as 'single' | 'announcement') ?? 'single',
        groupId: (raw.groupId as string) || undefined,
        sentCount: (raw.sentCount as number) ?? 1,
        totalCount: (raw.totalCount as number) ?? 1,
        createdAt:
          raw.createdAt instanceof Date
            ? raw.createdAt.toISOString()
            : new Date().toISOString(),
      };
    });

    return {
      data: sanitizedEmails,
      meta: {
        currentPage: safePage,
        totalPages,
        totalItems,
        limit: safeLimit,
        hasNextPage: safePage * safeLimit < totalItems,
        hasPrevPage: safePage > 1,
        success: successCount,
        failed: failedCount,
      },
    };
  }

  async getEmailStatsByMonth(): Promise<EmailStats[]> {
    const stats: EmailStats[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const [success, failed] = await Promise.all([
        this.emailModel.countDocuments({
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: true,
        }),
        this.emailModel.countDocuments({
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: false,
        }),
      ]);

      stats.push({
        month: d.toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
        }),
        success,
        failed,
      });
    }

    return stats;
  }
}
