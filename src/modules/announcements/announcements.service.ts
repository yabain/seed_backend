import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';
import {
  Announcement,
  AnnouncementDelivery,
  AnnouncementDocument,
  GROUP_LABELS,
  STATUS_LABELS,
} from './schemas/announcement.schema';
import {
  AnnouncementSettings,
  AnnouncementSettingsDocument,
} from './schemas/announcement-settings.schema';
import { DistributedLockDocument } from './schemas/distributed-lock.schema';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { UpdateAnnouncementSettingsDto } from './dto/update-settings.dto';
import { MailService } from '../mail/mail.service';
import { Admin } from '../auth/schemas/admin.schema';
import { Prospect } from '../prospects/prospect.schema';

const LOCK_KEY = 'announcements-wave-processor';
const LOCK_TTL_MS = 30_000;
export const WAVE_SIZE = 20;

interface ResolvedRecipient {
  userId?: string;
  userName?: string;
  userEmail: string;
  userPhone?: string;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectModel(Announcement.name)
    private readonly announcementModel: Model<AnnouncementDocument>,
    @InjectModel(AnnouncementSettings.name)
    private readonly settingsModel: Model<AnnouncementSettingsDocument>,
    @InjectModel('DistributedLock')
    private readonly lockModel: Model<DistributedLockDocument>,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<Admin>,
    @InjectModel(Prospect.name)
    private readonly prospectModel: Model<Prospect>,
    private readonly mailService: MailService,
  ) {}

  /* ------------------------------ CRUD ------------------------------ */

  async findAll(filters: {
    status?: string;
    group?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (filters.status) filter.status = filters.status;
    if (filters.group) filter.recipientGroup = filters.group;
    const keyword = filters.search?.trim();
    if (keyword) {
      filter.$or = [
        { subject: { $regex: keyword, $options: 'i' } },
        { customRecipients: { $regex: keyword, $options: 'i' } },
      ];
    }

    const safePage = Number.isFinite(filters.page)
      ? Math.max(1, Number(filters.page))
      : 1;
    const safeLimit = Number.isFinite(filters.limit)
      ? Math.min(100, Math.max(1, Number(filters.limit)))
      : 10;
    const skip = (safePage - 1) * safeLimit;

    const [data, totalItems] = await Promise.all([
      this.announcementModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.announcementModel.countDocuments(filter),
    ]);

    return {
      data: data.map((a) => this.sanitize(a)),
      stats: await this.getStats(),
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(totalItems / safeLimit)),
        totalItems,
        hasNextPage: safePage * safeLimit < totalItems,
        hasPrevPage: safePage > 1,
        limit: safeLimit,
      },
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Annonce introuvable.');
    }
    const doc = await this.announcementModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Annonce introuvable.');
    return this.sanitize(doc);
  }

  async create(dto: CreateAnnouncementDto) {
    const doc = await this.announcementModel.create({
      subject: dto.subject.trim(),
      bodyHtml: dto.bodyHtml,
      recipientGroup: dto.recipientGroup,
      customRecipients: dto.customRecipients ?? [],
      attachments: dto.attachments ?? [],
      includeHeader: dto.includeHeader ?? true,
      includeFooter: dto.includeFooter ?? true,
      status: 'draft',
    });
    return this.sanitize(doc.toObject() as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.announcementModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Annonce introuvable.');

    if (
      existing.status === 'sent' ||
      existing.status === 'sending'
    ) {
      throw new BadRequestException(
        "Une annonce envoyée ou en cours d'envoi ne peut plus être modifiée.",
      );
    }

    if (dto.subject !== undefined) existing.subject = dto.subject.trim();
    if (dto.bodyHtml !== undefined) existing.bodyHtml = dto.bodyHtml;
    if (dto.recipientGroup !== undefined)
      existing.recipientGroup = dto.recipientGroup as never;
    if (dto.customRecipients !== undefined)
      existing.customRecipients = dto.customRecipients;
    if (dto.attachments !== undefined)
      existing.attachments = dto.attachments as never;
    if (dto.includeHeader !== undefined)
      existing.includeHeader = dto.includeHeader;
    if (dto.includeFooter !== undefined)
      existing.includeFooter = dto.includeFooter;

    await existing.save();
    return this.sanitize(existing.toObject() as unknown as Record<string, unknown>);
  }

  async remove(id: string) {
    const doc = await this.announcementModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Annonce introuvable.');

    if (doc.status === 'sending') {
      throw new BadRequestException(
        'Impossible de supprimer une annonce dont l’envoi est en cours.',
      );
    }

    await this.announcementModel.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  /* ----------------------------- ACTIONS ---------------------------- */

  async sendNow(id: string) {
    const doc = await this.getEditableOrDraft(id);

    const recipients = await this.buildRecipients(
      doc.recipientGroup,
      doc.customRecipients,
    );

    if (!recipients.length) {
      throw new BadRequestException(
        'Aucun destinataire trouvé pour ce groupe.',
      );
    }

    doc.status = 'sending';
    doc.error = '';
    doc.deliveries = recipients.map((r) => ({
      email: r.userEmail,
      userId: r.userId,
      userName: r.userName ?? '',
      userPhone: r.userPhone ?? '',
      status: 'pending',
      attempts: 0,
    }));
    await doc.save();

    // Traite la première vague immédiatement pour un retour rapide côté UI.
    void this.processWaves(doc._id.toString()).catch((error) =>
      this.logger.warn('Traitement immédiat des vagues échoué :', error),
    );

    return this.sanitize(doc.toObject() as unknown as Record<string, unknown>);
  }

  async schedule(id: string, scheduledAtIso: string) {
    const doc = await this.getEditableOrDraft(id);

    const scheduledAt = new Date(scheduledAtIso);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Date de programmation invalide.');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La date de programmation doit être dans le futur.',
      );
    }

    doc.scheduledAt = scheduledAt;
    doc.status = 'scheduled';
    doc.error = '';
    await doc.save();

    return this.sanitize(doc.toObject() as unknown as Record<string, unknown>);
  }

  async cancelSchedule(id: string) {
    const doc = await this.announcementModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Annonce introuvable.');

    if (doc.status !== 'scheduled') {
      throw new BadRequestException("Cette annonce n'est pas programmée.");
    }

    doc.status = 'draft';
    doc.scheduledAt = null;
    await doc.save();

    return this.sanitize(doc.toObject() as unknown as Record<string, unknown>);
  }

  async duplicate(id: string) {
    const source = await this.announcementModel.findById(id).lean().exec();
    if (!source) throw new NotFoundException('Annonce introuvable.');

    const doc = await this.announcementModel.create({
      subject: `${source.subject} (copie)`,
      bodyHtml: source.bodyHtml,
      recipientGroup: source.recipientGroup,
      customRecipients: source.customRecipients ?? [],
      attachments: source.attachments ?? [],
      includeHeader: source.includeHeader ?? true,
      includeFooter: source.includeFooter ?? true,
      status: 'draft',
      scheduledAt: null,
    });

    return this.sanitize(doc.toObject() as unknown as Record<string, unknown>);
  }

  async getStats() {
    const [total, draft, scheduled, sending, sent, failed] =
      await Promise.all([
        this.announcementModel.countDocuments(),
        this.announcementModel.countDocuments({ status: 'draft' }),
        this.announcementModel.countDocuments({ status: 'scheduled' }),
        this.announcementModel.countDocuments({ status: 'sending' }),
        this.announcementModel.countDocuments({ status: 'sent' }),
        this.announcementModel.countDocuments({ status: 'failed' }),
      ]);

    return { total, draft, scheduled, sending, sent, failed };
  }

  /* ----------------------------- RÉGLAGES --------------------------- */

  async getSettings(): Promise<AnnouncementSettings & { id: string }> {
    let doc = await this.settingsModel.findOne().exec();
    if (!doc) {
      doc = await this.settingsModel.create({
        headerHtml: DEFAULT_HEADER_HTML,
        footerHtml: DEFAULT_FOOTER_HTML,
      });
    }
    const raw = doc.toObject() as unknown as Record<string, unknown>;
    return {
      id: String(raw._id),
      headerHtml: (raw.headerHtml as string) || '',
      footerHtml: (raw.footerHtml as string) || '',
    };
  }

  async updateSettings(dto: UpdateAnnouncementSettingsDto) {
    const current = await this.getSettings();
    const doc = await this.settingsModel
      .findByIdAndUpdate(
        current.id,
        {
          headerHtml:
            dto.headerHtml !== undefined
              ? dto.headerHtml
              : current.headerHtml,
          footerHtml:
            dto.footerHtml !== undefined
              ? dto.footerHtml
              : current.footerHtml,
        },
        { new: true, upsert: true },
      )
      .exec();

    const raw = doc!.toObject() as unknown as Record<string, unknown>;
    return {
      id: String(raw._id),
      headerHtml: (raw.headerHtml as string) || '',
      footerHtml: (raw.footerHtml as string) || '',
    };
  }

  async preview(
    bodyHtml: string,
    includeHeader = true,
    includeFooter = true,
  ): Promise<string> {
    const settings = await this.getSettings();
    return this.composeEmail('Aperçu de votre annonce', bodyHtml, settings, {
      includeHeader,
      includeFooter,
    });
  }

  /* -------------------------- ENVOI PAR VAGUES ---------------------- */

  async processScheduledAndSending(): Promise<void> {
    const lock = await this.acquireLock();
    if (!lock) return;

    try {
      const dueAnnouncement = await this.announcementModel
        .findOne({
          $or: [
            { status: 'sending' },
            { status: 'scheduled', scheduledAt: { $lte: new Date() } },
          ],
        })
        .sort({ createdAt: 1 })
        .exec();

      if (!dueAnnouncement) return;

      if (dueAnnouncement.status === 'scheduled') {
        dueAnnouncement.status = 'sending';

        const recipients = await this.buildRecipients(
          dueAnnouncement.recipientGroup,
          dueAnnouncement.customRecipients,
        );

        if (!recipients.length) {
          dueAnnouncement.status = 'failed';
          dueAnnouncement.error = 'Aucun destinataire trouvé.';
          dueAnnouncement.lastRunAt = new Date();
          await dueAnnouncement.save();
          return;
        }

        dueAnnouncement.deliveries = recipients.map((r) => ({
          email: r.userEmail,
          userId: r.userId,
          userName: r.userName ?? '',
          userPhone: r.userPhone ?? '',
          status: 'pending',
          attempts: 0,
        }));
      }

      await dueAnnouncement.save();
      await this.processWaves(dueAnnouncement._id.toString());
    } catch (error) {
      this.logger.error('Erreur du processeur d’annonces :', error);
    } finally {
      await this.releaseLock(lock);
    }
  }

  private async processWaves(announcementId: string): Promise<void> {
    for (let wave = 0; wave < 5000; wave++) {
      const doc = await this.announcementModel
        .findById(announcementId)
        .exec();
      if (!doc || doc.status !== 'sending') return;

      const pending = doc.deliveries.filter((d) => d.status === 'pending');
      if (!pending.length) {
        const failedCount = doc.deliveries.filter(
          (d) => d.status === 'failed',
        ).length;

        doc.status = failedCount === doc.deliveries.length ? 'failed' : 'sent';
        doc.sentAt = new Date();
        doc.lastRunAt = new Date();
        await doc.save();
        return;
      }

      const wave = pending.slice(0, WAVE_SIZE);
      await Promise.all(
        wave.map((delivery) =>
          this.sendSingle(doc, delivery).catch(() => undefined),
        ),
      );

      doc.markModified('deliveries');
      doc.lastRunAt = new Date();
      await doc.save();

      if (pending.length > WAVE_SIZE) {
        // Pause anti-spam entre les vagues.
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }

  private async sendSingle(
    doc: AnnouncementDocument,
    delivery: AnnouncementDelivery,
  ): Promise<void> {
    try {
      const settings = await this.getSettings();
      const html = this.composeEmail(doc.subject, doc.bodyHtml, settings, {
        includeHeader: doc.includeHeader ?? true,
        includeFooter: doc.includeFooter ?? true,
        vars: {
          userName: delivery.userName || '',
          userEmail: delivery.email,
          userPhone: delivery.userPhone || '',
        },
      });

      const ok = await this.mailService.send({
        to: delivery.email,
        subject: doc.subject,
        html,
        attachments: (doc.attachments ?? []).map((a) => ({
          filename: a.fileName,
          path: path.join(process.cwd(), a.path.replace(/^\//, '')),
        })),
      });

      delivery.attempts += 1;
      if (ok) {
        delivery.status = 'sent';
        delivery.sentAt = new Date();
        delivery.error = '';
      } else {
        delivery.status = 'failed';
        delivery.error = 'SMTP non configuré ou indisponible.';
      }
    } catch (error) {
      delivery.attempts += 1;
      delivery.status = 'failed';
      delivery.error =
        error instanceof Error ? error.message : 'Erreur inconnue.';
    }
  }

  /* --------------------------- DESTINATAIRES ------------------------ */

  private async buildRecipients(
    group: string,
    customRecipients: string[],
  ): Promise<ResolvedRecipient[]> {
    const map = new Map<string, ResolvedRecipient>();

    if (group === 'all_prospects') {
      const prospects = await this.prospectModel
        .find({ email: { $exists: true, $ne: '' } })
        .select('name email phone')
        .lean()
        .exec();
      prospects.forEach((p) => {
        const email = (p.email || '').toLowerCase().trim();
        if (email && !map.has(email)) {
          map.set(email, {
            userName: p.name || '',
            userEmail: email,
            userPhone: p.phone || '',
          });
        }
      });
    } else {
      const rolesFilter: Record<string, unknown> = { isActive: true };
      if (group === 'all_users') rolesFilter.role = 'user';
      else if (group === 'all_consultants') rolesFilter.role = 'consultant';
      else if (group === 'all_admins')
        rolesFilter.role = { $in: ['admin', 'superadmin'] };

      const accounts = await this.adminModel
        .find(rolesFilter)
        .select('name email phone role')
        .lean()
        .exec();
      accounts.forEach((a) => {
        const email = (a.email || '').toLowerCase().trim();
        if (email && !map.has(email)) {
          map.set(email, {
            userId: String(a._id),
            userName: a.name || '',
            userEmail: email,
            userPhone: a.phone || '',
          });
        }
      });
    }

    (customRecipients ?? []).forEach((raw) => {
      const email = raw.toLowerCase().trim();
      if (email.includes('@') && !map.has(email)) {
        map.set(email, { userEmail: email, userName: '' });
      }
    });

    return Array.from(map.values());
  }

  /* ------------------------------ OUTILS ---------------------------- */

  private composeEmail(
    subject: string,
    bodyHtml: string,
    settings: { headerHtml: string; footerHtml: string },
    options?: {
      includeHeader?: boolean;
      includeFooter?: boolean;
      vars?: Partial<Record<'userName' | 'userEmail' | 'userPhone', string>>;
    },
  ): string {
    const includeHeader = options?.includeHeader ?? true;
    const includeFooter = options?.includeFooter ?? true;
    const name = options?.vars?.userName ?? 'Cher membre';
    const [firstName, ...rest] = name.split(' ');
    const replacements: Record<string, string> = {
      '{userName}': name,
      '{userFirstName}': firstName || name,
      '{userLastName}': rest.join(' ') || '',
      '{userEmail}': options?.vars?.userEmail ?? '',
      '{userPhone}': options?.vars?.userPhone ?? '',
      '{subject}': subject,
    };

    const replaceVars = (input: string): string =>
      Object.entries(replacements).reduce(
        (acc, [key, value]) => acc.split(key).join(value),
        input ?? '',
      );

    return [
      ...(includeHeader ? [replaceVars(settings.headerHtml)] : []),
      replaceVars(bodyHtml),
      ...(includeFooter ? [replaceVars(settings.footerHtml)] : []),
    ].join('\n');
  }

  private async getEditableOrDraft(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Annonce introuvable.');
    }
    const doc = await this.announcementModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Annonce introuvable.');
    if (doc.status === 'sending' || doc.status === 'sent') {
      throw new BadRequestException(
        'Cette annonce est déjà envoyée ou en cours d’envoi.',
      );
    }
    return doc;
  }

  private sanitize(doc: Record<string, unknown>) {
    const deliveries = (doc.deliveries as AnnouncementDelivery[]) ?? [];
    const counts = {
      total: deliveries.length,
      sent: deliveries.filter((d) => d?.status === 'sent').length,
      failed: deliveries.filter((d) => d?.status === 'failed').length,
      pending: deliveries.filter((d) => d?.status === 'pending').length,
    };

    return {
      ...doc,
      id: String(doc._id),
      groupLabel: GROUP_LABELS[doc.recipientGroup as keyof typeof GROUP_LABELS] ?? '',
      statusLabel: STATUS_LABELS[doc.status as keyof typeof STATUS_LABELS] ?? '',
      counts,
      deliveries: deliveries.map((d) => ({
        email: d.email,
        userName: d.userName,
        userPhone: d.userPhone,
        status: d.status,
        attempts: d.attempts,
        error: d.error,
        sentAt: d.sentAt ?? null,
      })),
      _id: undefined,
      __v: undefined,
    };
  }

  private async acquireLock() {
    const now = new Date();
    try {
      return await this.lockModel.findOneAndUpdate(
        { key: LOCK_KEY, expiresAt: { $lte: now } },
        { key: LOCK_KEY, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch {
      return null;
    }
  }

  private async releaseLock(lock: DistributedLockDocument) {
    try {
      await this.lockModel.deleteOne({ _id: lock._id }).exec();
    } catch {
      // Ignoré : expiration automatique par TTL.
    }
  }
}

const DEFAULT_HEADER_HTML = `<div style="background:#ffffff;border-bottom:3px solid #16a34a;padding:24px;text-align:center;font-family:Arial,sans-serif;">
  <h1 style="margin:0;color:#111827;font-size:22px;">{subject}</h1>
</div>`;

const DEFAULT_FOOTER_HTML = `<div style="background:#f8fafc;padding:18px;text-align:center;color:#64748b;font-size:12px;font-family:Arial,sans-serif;">
  Vous recevez cet e-mail en tant que membre de notre communauté.<br />
  Pour toute question, contactez-nous à tout moment.
</div>`;
