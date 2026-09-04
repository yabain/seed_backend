import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { SmtpService } from '../smtp/smtp.service';
import { EmailLog, EmailLogDocument } from '../email/email.schema';

export interface SendMailAttachment {
  filename: string;
  path: string;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: SendMailAttachment[];
  /** Contrôle l'enregistrement du log. `false` désactive l'enregistrement (ex. annonces, gérées par lot). */
  log?: boolean;
}

export interface SaveEmailLogData {
  from: string;
  to: string;
  subject: string;
  body: string;
  status: boolean;
  category?: 'single' | 'announcement';
  groupId?: string;
  sentCount?: number;
  totalCount?: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smtpService: SmtpService,
    @InjectModel(EmailLog.name)
    private readonly emailLogModel: Model<EmailLogDocument>,
  ) {}

  private async buildTransporter(): Promise<nodemailer.Transporter | null> {
    const config = await this.smtpService.getSmtpData();
    if (!config || !config.status) {
      this.logger.warn('SMTP non configuré : aucun e-mail ne sera envoyé.');
      return null;
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

  private fromAddress(): string {
    return (
      this.configService.get<string>('SMTP_FROM') ??
      `Organisation <${this.configService.get<string>('SMTP_USER') ?? 'no-reply@example.org'}>`
    );
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const transporter = await this.buildTransporter();
    const shouldLog = options.log !== false;

    if (!transporter) {
      if (shouldLog) {
        await this.saveLog({
          from: this.fromAddress(),
          to: this.stringifyTo(options.to),
          subject: options.subject,
          body: options.html,
          status: false,
        });
      }
      return false;
    }

    const from = this.fromAddress();
    try {
      const result = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      // Nodemailer ne lève pas systématiquement une erreur lorsqu'un serveur
      // SMTP rejette un destinataire : il renseigne alors `rejected` dans sa
      // réponse. Une annonce étant envoyée destinataire par destinataire, ne
      // pas le contrôler faisait apparaître ces échecs comme des envois réussis.
      const rejected = result.rejected ?? [];
      const accepted = result.accepted ?? [];
      const success = rejected.length === 0 && accepted.length > 0;

      if (shouldLog) {
        await this.saveLog({
          from,
          to: this.stringifyTo(options.to),
          subject: options.subject,
          body: options.html,
          status: success,
        });
      }

      if (!success) {
        this.logger.warn(
          `E-mail non accepté par le serveur SMTP « ${options.subject} » ` +
            `(destinataire : ${this.stringifyTo(options.to)}; ` +
            `rejetés : ${rejected.join(', ') || 'aucun'}; réponse : ${result.response || 'inconnue'}).`,
        );
        return false;
      }

      return true;
    } catch (error) {
      if (shouldLog) {
        await this.saveLog({
          from,
          to: this.stringifyTo(options.to),
          subject: options.subject,
          body: options.html,
          status: false,
        });
      }
      this.logger.error(
        `Échec de l'envoi de l'e-mail « ${options.subject} » :`,
        error,
      );
      return false;
    }
  }

  /** Enregistre un e-mail sortant (succès ou échec) dans la collection des logs. */
  async saveLog(data: SaveEmailLogData): Promise<void> {
    try {
      await this.emailLogModel.create({
        from: data.from,
        to: data.to,
        subject: data.subject,
        body: data.body,
        status: data.status,
        category: data.category ?? 'single',
        groupId: data.groupId,
        sentCount: data.sentCount ?? 1,
        totalCount: data.totalCount ?? 1,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'enregistrement du log e-mail « ${data.subject} » :`,
        error,
      );
    }
  }

  private stringifyTo(to: string | string[]): string {
    return Array.isArray(to) ? to.join(', ') : to;
  }

  async sendWithLogging(
    options: SendMailOptions,
    emailService: {
      saveMail: (data: {
        from: string;
        to: string;
        subject: string;
        body: string;
        status: boolean;
      }) => Promise<void>;
    },
  ): Promise<boolean> {
    const transporter = await this.buildTransporter();
    if (!transporter) {
      return false;
    }

    const from = this.fromAddress();
    try {
      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      });
      await emailService.saveMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        body: options.html,
        status: true,
      });
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await emailService.saveMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        body: options.html,
        status: false,
      });
      this.logger.error(
        `Échec de l'envoi de l'e-mail « ${options.subject} » :`,
        error,
      );
      throw new BadRequestException(
        `Échec de l'envoi de l'e-mail : ${errorMessage}`,
      );
    }
  }
}
