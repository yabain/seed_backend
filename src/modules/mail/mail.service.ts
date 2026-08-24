import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SmtpService } from '../smtp/smtp.service';

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
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smtpService: SmtpService,
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
      `SEED <${this.configService.get<string>('SMTP_USER') ?? 'no-reply@seed.org'}>`
    );
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const transporter = await this.buildTransporter();
    if (!transporter) {
      return false;
    }

    try {
      await transporter.sendMail({
        from: this.fromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi de l'e-mail « ${options.subject} » :`,
        error,
      );
      return false;
    }
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
