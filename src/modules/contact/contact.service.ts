import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  ContactMessage,
  ContactMessageDocument,
} from './schemas/contact-message.schema';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { Admin, AdminDocument } from '../auth/schemas/admin.schema';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  contactNotificationTemplate,
  contactConfirmationTemplate,
  type ContactTemplateOptions,
} from '../mail/templates/contact.templates';
import { SiteService } from '../site/site.service';
import { whatsappNotificationFooter } from '../../common/utils/frontend-url.util';
import {
  emailSocialFromSiteConfig,
  emailLogoFromSiteConfig,
} from '../../common/utils/email-social.util';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(ContactMessage.name)
    private readonly messageModel: Model<ContactMessageDocument>,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly siteService: SiteService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    const created = await this.messageModel.create(dto);
    const message = created as unknown as ContactMessageDocument & {
      createdAt: Date;
    };

    const siteConfig = await this.siteService.getPublicConfig();
    const recipients = await this.resolveRecipients(siteConfig.email);
    const fromVisitor = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? '',
      subject: dto.subject,
      message: dto.message,
      createdAt: message.createdAt,
    };

    const branding: ContactTemplateOptions['branding'] = {
      logo: this.siteService.resolveMediaUrl(emailLogoFromSiteConfig(siteConfig, this.configService)),
      orgName: siteConfig.orgName,
      social: emailSocialFromSiteConfig(siteConfig, this.configService),
    };
    const colors: ContactTemplateOptions['colors'] = {
      primary: siteConfig.primaryColor,
      secondary: siteConfig.secondaryColor,
    };

    // 1) Notification aux administrateurs + email de contact système.
    await this.mailService.send({
      to: recipients,
      subject: `Nouveau message de contact : ${dto.subject}`,
      html: contactNotificationTemplate({
        payload: fromVisitor,
        colors,
        branding,
      }),
      replyTo: dto.email,
    });

    // 2) Accusé de réception automatique au visiteur, sur son adresse.
    await this.mailService.send({
      to: dto.email,
      subject: 'Nous avons bien reçu votre message',
      html: contactConfirmationTemplate({
        payload: fromVisitor,
        colors,
        branding,
      }),
    });

    // 3) WhatsApp (best effort) : notification aux admins + numéros de contact système.
    const siteOrg = siteConfig.orgName?.trim() || 'Organisation';
    const messageForAdmin = [
      `🆕 Nouveau message de contact : ${siteOrg}`,
      dto.name ? `\nDe : ${dto.name}` : '',
      dto.email ? `\nE-mail : ${dto.email}` : '',
      dto.phone ? `\nTél : ${dto.phone}` : '',
      `\n\nSujet : ${dto.subject}`,
      `\n\n${dto.message}`,
    ].join('');
    await this.notifyAdminsWhatsapp(messageForAdmin);
    await this.notifySystemWhatsapp(messageForAdmin, siteConfig.phone, siteConfig.phone2);

    const visitorPhone = (dto.phone ?? '').trim();
    if (visitorPhone) {
      await this.sendWhatsapp(
        visitorPhone,
        `✅ ${siteOrg} — Nous avons bien reçu votre message.\n\nMerci ${dto.name || 'à vous'}, nous reviendrons vers vous dès que possible au sujet : ${dto.subject}.`,
      );
    }

    return message;
  }

  /** Notifie les admins (notifyContact) par WhatsApp. */
  private async notifyAdminsWhatsapp(message: string): Promise<void> {
    const phones = await this.whatsappService.getAdminPhones('notifyContact');
    for (const phone of phones) {
      await this.sendWhatsapp(phone, message);
    }
  }

  /** Notifie les numéros de contact du système (site-config.phone / phone2) par WhatsApp. */
  private async notifySystemWhatsapp(
    message: string,
    ...phones: Array<string | undefined>
  ): Promise<void> {
    const seen = new Set<string>();
    for (const raw of phones) {
      const phone = (raw ?? '').trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      await this.sendWhatsapp(phone, message);
    }
  }

  private async sendWhatsapp(phone: string, message: string): Promise<void> {
    const clean = (phone ?? '').trim();
    if (!clean) return;
    try {
      const footer = whatsappNotificationFooter(this.configService);
      await this.whatsappService.sendText(clean, `${message}\n\n${footer}`);
    } catch (error) {
      this.logger.warn(
        `Message WhatsApp contact non envoyé à ${clean} : ${(error as Error)?.message || error}`,
      );
    }
  }

  /** Destinataires e-mail : admins actifs (`notifyContact`) + email de contact système. */
  private async resolveRecipients(siteEmail?: string): Promise<string[]> {
    const admins = await this.adminModel
      .find({
        isActive: true,
        role: { $in: ['admin', 'superadmin'] },
        notifyContact: true,
        email: { $exists: true, $ne: '' },
      })
      .select('email')
      .lean()
      .exec();
    const emails = admins.map((admin) => admin.email).filter(Boolean);

    // Email de contact système : site-config.email, sinon CONTACT_RECIPIENT_EMAIL.
    const systemEmail = (siteEmail ?? '').trim();
    const fallback = (
      this.configService.get<string>('CONTACT_RECIPIENT_EMAIL') ?? ''
    )
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    const all = [...fallback, systemEmail ? systemEmail : '', ...emails]
      .filter((email) => email && email.length > 0)
      .filter((email, index, arr) => arr.indexOf(email) === index); // déduplique

    if (all.length === 0) {
      // Dernier filet : expéditeur SMTP, pour ne jamais perdre la notification.
      const smtpUser = this.configService.get<string>('SMTP_USER') ?? '';
      if (smtpUser) all.push(smtpUser);
    }
    return all;
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    read?: string;
    search?: string;
  }): Promise<{
    items: ContactMessage[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const filter: Record<string, unknown> = {};

    if (query.read === 'true' || query.read === 'false') {
      filter.isRead = query.read === 'true';
    }

    const search = (query.search ?? '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { subject: { $regex: escaped, $options: 'i' } },
        { message: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total, unreadCount] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
      this.messageModel.countDocuments({ isRead: false }).exec(),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  async findOne(id: string): Promise<ContactMessage> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Message introuvable');
    }
    const message = await this.messageModel.findById(id).lean().exec();
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    return message;
  }

  async markRead(
    id: string,
    dto: UpdateContactMessageDto,
  ): Promise<ContactMessage> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Message introuvable');
    }
    const message = await this.messageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean()
      .exec();
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    return message;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Message introuvable');
    }
    const result = await this.messageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Message introuvable');
    }
    return { deleted: true };
  }
}
