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
import {
  contactNotificationTemplate,
  contactConfirmationTemplate,
  type ContactTemplateOptions,
} from '../mail/templates/contact.templates';
import { SiteService } from '../site/site.service';
import { emailSocialFromEnv } from '../../common/utils/email-social.util';

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
  ) {}

  async create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    const created = await this.messageModel.create(dto);
    const message = created as unknown as ContactMessageDocument & {
      createdAt: Date;
    };

    const recipients = await this.resolveRecipients();
    const fromVisitor = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? '',
      subject: dto.subject,
      message: dto.message,
      createdAt: message.createdAt,
    };

    const siteConfig = await this.siteService.getPublicConfig();
    const branding: ContactTemplateOptions['branding'] = {
      logo: this.siteService.resolveMediaUrl(siteConfig.logo),
      orgName: siteConfig.orgName,
      social: emailSocialFromEnv(this.configService),
    };
    const colors: ContactTemplateOptions['colors'] = {
      primary: siteConfig.primaryColor,
      secondary: siteConfig.secondaryColor,
    };

    // 1) Notification aux administrateurs (avec récapitulatif complet).
    await this.mailService.send({
      to: recipients,
      subject: `Nouveau message de contact — ${dto.subject}`,
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

    return message;
  }

  /** Détermine les destinataires de la notification : les comptes actifs ayant `notifyContact: true`. */
  private async resolveRecipients(): Promise<string[]> {
    const admins = await this.adminModel
      .find({
        isActive: true,
        notifyContact: true,
        email: { $exists: true, $ne: '' },
      })
      .select('email')
      .lean()
      .exec();
    const emails = admins.map((admin) => admin.email).filter(Boolean);

    if (emails.length > 0) {
      return emails;
    }

    const fallback =
      this.configService
        .get<string>('CONTACT_RECIPIENT_EMAIL')
        ?.split(',')
        .map((email) => email.trim())
        .filter(Boolean) ?? [];
    return fallback;
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
