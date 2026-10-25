import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId } from 'mongoose';
import { Model } from 'mongoose';
import { Prospect, ProspectDocument } from './prospect.schema';
import { Admin, AdminDocument } from '../auth/schemas/admin.schema';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { renderEmailLayout, escapeHtml } from '../mail/templates/layout';
import { SiteService } from '../site/site.service';
import { whatsappNotificationFooter } from '../../common/utils/frontend-url.util';
import {
  emailSocialFromSiteConfig,
  emailLogoFromSiteConfig,
} from '../../common/utils/email-social.util';

export interface ProspectItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface ProspectPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface ProspectListResult {
  data: ProspectItem[];
  pagination: ProspectPagination;
}

export interface ProspectImportResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  ignored: number;
}

@Injectable()
export class ProspectsService {
  private readonly logger = new Logger(ProspectsService.name);

  constructor(
    @InjectModel(Prospect.name)
    private readonly prospectModel: Model<ProspectDocument>,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    private readonly mailService: MailService,
    private readonly siteService: SiteService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getOne(id: string): Promise<ProspectItem> {
    const realId = this.ensureId(id);
    const item = await this.prospectModel.findById(realId).lean().exec();
    if (!item) throw new NotFoundException('Prospect introuvable.');
    return { ...item, id: (item as any)._id.toString(), createdAt: (item as any).createdAt?.toISOString() || '' } as ProspectItem;
  }

  async list(page = 1, limit = 25, keyword = ''): Promise<ProspectListResult> {
    const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, Number(limit)))
      : 25;
    const skip = (safePage - 1) * safeLimit;
    const trimmedKeyword = keyword.trim();

    const filter: Record<string, unknown> = {};
    if (trimmedKeyword) {
      filter.$or = [
        { name: { $regex: trimmedKeyword, $options: 'i' } },
        { email: { $regex: trimmedKeyword, $options: 'i' } },
        { phone: { $regex: trimmedKeyword, $options: 'i' } },
      ];
    }

    const [data, totalItems] = await Promise.all([
      this.prospectModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.prospectModel.countDocuments(filter),
    ]);

    return {
      data: data.map((prospect) => this.sanitize(prospect)),
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

  async create(dto: CreateProspectDto): Promise<ProspectItem> {
    const email = (dto.email || '').toLowerCase().trim();
    const phone = (dto.phone || '').trim();

    if (!email && !phone) {
      throw new BadRequestException('L’e-mail ou le téléphone est requis.');
    }

    const existing = await this.prospectModel
      .findOne({
        $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      })
      .exec();

    if (existing) {
      throw new BadRequestException(
        'Un prospect existe déjà avec cet e-mail ou ce numéro.',
      );
    }

    let created: ProspectDocument;
    try {
      created = await this.prospectModel.create({
        name: dto.name?.trim() || '',
        email,
        phone,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException(
          'Un prospect existe déjà avec cet e-mail ou ce numéro.',
        );
      }
      throw error;
    }

    const sanitized = this.sanitize(
      (created.toObject ? created.toObject() : created) as unknown as Record<
        string,
        unknown
      >,
    );

    void this.sendConfirmationEmail(sanitized).catch((error) =>
      this.logger.warn(
        'Failed to send subscription confirmation email:',
        error,
      ),
    );
    void this.sendConfirmationWhatsapp(sanitized);
    void this.notifyAdminsNewsletter(sanitized).catch((error) =>
      this.logger.warn('Failed to notify admins of new newsletter:', error),
    );

    return sanitized;
  }

  async update(id: string, dto: UpdateProspectDto): Promise<ProspectItem> {
    const existing = await this.prospectModel.findById(id).lean().exec();
    if (!existing) {
      throw new NotFoundException('Prospect introuvable.');
    }

    const email = (dto.email || '').toLowerCase().trim();
    const phone = (dto.phone || '').trim();

    const duplicate = await this.prospectModel
      .findOne({
        $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
        _id: { $ne: existing._id },
      })
      .exec();

    if (duplicate) {
      throw new BadRequestException(
        'Un prospect existe déjà avec cet e-mail ou ce numéro.',
      );
    }

    let updated;
    try {
      updated = await this.prospectModel
        .findByIdAndUpdate(
          id,
          {
            name: dto.name?.trim() ?? existing.name,
            email: email || existing.email,
            phone: phone || existing.phone,
          },
          { new: true },
        )
        .lean()
        .exec();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException(
          'Un prospect existe déjà avec cet e-mail ou ce numéro.',
        );
      }
      throw error;
    }

    if (!updated) {
      throw new NotFoundException('Prospect introuvable.');
    }

    return this.sanitize(updated);
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const result = await this.prospectModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Prospect introuvable.');
    }
    return { deleted: true };
  }

  async removeMatchingProspect(email?: string, phone?: string): Promise<void> {
    const filters: Record<string, unknown>[] = [];
    if (email) filters.push({ email: email.toLowerCase().trim() });
    if (phone) filters.push({ phone: phone.trim() });
    if (!filters.length) return;

    await this.prospectModel.deleteMany({ $or: filters }).exec();
  }

  async findAllRecipients(): Promise<
    Array<{ email?: string; phone?: string }>
  > {
    const prospects = await this.prospectModel
      .find({
        $or: [
          { email: { $exists: true, $ne: '' } },
          { phone: { $exists: true, $ne: '' } },
        ],
      })
      .select('email phone')
      .lean()
      .exec();

    return prospects.map((p) => ({
      email: p.email || undefined,
      phone: p.phone || undefined,
    }));
  }

  private sanitize(prospect: Record<string, unknown>): ProspectItem {
    const raw = prospect;
    return {
      id: String(raw._id),
      name: (raw.name as string) || '',
      email: (raw.email as string) || '',
      phone: (raw.phone as string) || '',
      createdAt:
        raw.createdAt instanceof Date
          ? raw.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }

private async sendConfirmationEmail(prospect: ProspectItem): Promise<void> {
    if (!prospect.email) return;

    const siteConfig = await this.siteService.getPublicConfig();
    const branding = {
      logo: emailLogoFromSiteConfig(siteConfig, this.configService),
      orgName: siteConfig.orgName,
      social: emailSocialFromSiteConfig(siteConfig, this.configService),
    };

    const html = renderEmailLayout({
      title: `Bienvenue chez ${siteConfig.orgName?.trim() || 'notre organisation'}`,
      preheader: "Merci de vous être inscrit à notre boîte aux lettres.",
      contentHtml: `
        <p>Bonjour <strong>${escapeHtml(prospect.name || '')}</strong>,</p>
        <p>Merci de vous être inscrit à notre boîte aux lettres. Vous recevrez bientôt nos actualités.</p>
        <p style="margin:18px 0 0;color:#64748b;font-size:14px;">
          Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.
        </p>
      `,
      branding,
    });

    await this.mailService.send({
      to: prospect.email,
      subject: `Bienvenue chez ${siteConfig.orgName?.trim() || 'notre organisation'} — boîte aux lettres`,
      html,
    });
  }

  /** Accusé d'inscription à la newsletter par WhatsApp (si un numéro est fourni). */
  private async sendConfirmationWhatsapp(prospect: ProspectItem): Promise<void> {
    const phone = (prospect.phone ?? '').trim();
    if (!phone) return;
    try {
      const siteConfig = await this.siteService.getPublicConfig();
      const orgName = siteConfig.orgName?.trim() || 'notre organisation';
      const name = prospect.name?.trim();
      const footer = whatsappNotificationFooter(this.configService);
      await this.whatsappService.sendText(
        phone,
        `✅ ${orgName} — Inscription à la boîte aux lettres${name ? `\n\nBonjour ${name},` : '\n\nBonjour,'} votre inscription est bien enregistrée. Vous recevrez bientôt nos actualités.\n\n${footer}`,
      );
    } catch (error) {
      this.logger.warn(
        `Confirmation WhatsApp newsletter non envoyée à ${phone} : ${(error as Error)?.message || error}`,
      );
    }
  }

  /**
   * Notifie les admins (notifyNewsletter) d'une nouvelle inscription : envoie
   * les détails du prospect par e-mail et par WhatsApp.
   */
  private async notifyAdminsNewsletter(prospect: ProspectItem): Promise<void> {
    const admins = await this.adminModel
      .find({
        isActive: true,
        role: { $in: ['admin', 'superadmin'] },
        notifyNewsletter: { $ne: false },
        email: { $exists: true, $ne: '' },
      })
      .select('email')
      .lean()
      .exec();
    const emails = admins.map((a) => a.email).filter(Boolean);

    if (emails.length) {
      const siteConfig = await this.siteService.getPublicConfig();
      const branding = {
        logo: emailLogoFromSiteConfig(siteConfig, this.configService),
        orgName: siteConfig.orgName,
        social: emailSocialFromSiteConfig(siteConfig, this.configService),
      };
      const name = prospect.name?.trim();
      const html = renderEmailLayout({
        title: "Nouvelle inscription à la boîte aux lettres",
        preheader: "Une personne vient de s'inscrire à la boîte aux lettres.",
        contentHtml: `
          <p>Un visiteur vient de s'inscrire à la boîte aux lettres :</p>
          ${name ? `<p><strong>Nom :</strong> ${escapeHtml(name)}</p>` : ''}
          <p><strong>E-mail :</strong> ${escapeHtml(prospect.email)}</p>
          ${prospect.phone ? `<p><strong>Tél :</strong> ${escapeHtml(prospect.phone)}</p>` : ''}
        `,
        branding,
      });
      await this.mailService.send({
        to: emails,
        subject: "Nouvelle inscription à la boîte aux lettres",
        html,
      });
    }

    const phones = await this.whatsappService.getAdminPhones('notifyNewsletter');
    for (const phone of phones) {
      try {
        const footer = whatsappNotificationFooter(this.configService);
        await this.whatsappService.sendText(
          phone,
          `🆕 Nouvelle inscription à la boîte aux lettres\n\nNom : ${prospect.name?.trim() || '—'}\nE-mail : ${prospect.email}\nTél : ${prospect.phone || '—'}\n\n${footer}`,
        );
      } catch (error) {
        this.logger.warn(
          `Notification newsletter WhatsApp non envoyée à ${phone} : ${(error as Error)?.message || error}`,
        );
      }
    }
  }

  async exportExcel(): Promise<Buffer> {
    const prospects = await this.prospectModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const rows = prospects.map((p) => {
      const raw = p as Record<string, unknown>;
      return {
        Nom: typeof raw.name === 'string' ? raw.name : '',
        Email: typeof raw.email === 'string' ? raw.email : '',
        Telephone: typeof raw.phone === 'string' ? raw.phone : '',
        'Date inscription':
          raw.createdAt instanceof Date
            ? raw.createdAt.toISOString().replace('T', ' ').split('.')[0]
            : '',
      };
    });

    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospects');

    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }

  async downloadTemplate(): Promise<Buffer> {
    const template = [
      {
        Nom: 'Jean Dupont',
        Email: 'jean@example.com',
        Telephone: '+2250700000000',
        'Date inscription': '2024-01-15',
      },
    ];

    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospects');

    const bufferData = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData as ArrayBuffer);
  }

  private getString(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null) {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    return '';
  }

  /** Liste des pays avec indicatif de téléphone (pour le modal d'import). */
  readonly COUNTRY_INDICATORS = new Map([
    ['237', '+237'],
    ['225', '+225'],
    ['241', '+241'],
    ['226', '+226'],
    ['255', '+255'],
    ['263', '+263'],
    ['27', '+27'],
    ['298', '+298'],
    ['299', '+299'],
    ['91', '+91'],
    ['234', '+234'],
    ['239', '+239'],
    ['250', '+250'],
    ['240', '+240'],
    ['248', '+248'],
    ['268', '+268'],
    ['355', '+355'],
    ['372', '+372'],
    ['380', '+380'],
    ['381', '+381'],
    ['382', '+382'],
    ['385', '+385'],
    ['39', '+39'],
    ['40', '+40'],
    ['421', '+421'],
    ['423', '+423'],
    ['43', '+43'],
    ['503', '+503'],
    ['504', '+504'],
    ['506', '+506'],
    ['52', '+52'],
    ['53', '+53'],
    ['54', '+54'],
    ['55', '+55'],
    ['56', '+56'],
    ['57', '+57'],
    ['60', '+60'],
    ['63', '+63'],
    ['64', '+64'],
    ['65', '+65'],
    ['66', '+66'],
    ['670', '+670'],
    ['673', '+673'],
    ['680', '+680'],
    ['681', '+681'],
    ['682', '+682'],
    ['683', '+683'],
    ['686', '+686'],
    ['689', '+689'],
    ['700', '+700'],
    ['704', '+704'],
    ['706', '+706'],
    ['707', '+707'],
    ['708', '+708'],
    ['709', '+709'],
    ['710', '+710'],
    ['712', '+712'],
    ['713', '+713'],
    ['714', '+714'],
    ['716', '+716'],
    ['718', '+718'],
    ['719', '+719'],
    ['720', '+720'],
    ['722', '+722'],
    ['724', '+724'],
    ['729', '+729'],
    ['740', '+740'],
    ['752', '+752'],
    ['755', '+755'],
    ['757', '+757'],
    ['758', '+758'],
    ['760', '+760'],
    ['762', '+762'],
    ['763', '+763'],
    ['764', '+764'],
    ['767', '+767'],
    ['768', '+768'],
    ['772', '+772'],
    ['773', '+773'],
    ['779', '+779'],
    ['780', '+780'],
    ['787', '+787'],
    ['790', '+790'],
    ['792', '+792'],
    ['794', '+794'],
    ['795', '+795'],
    ['798', '+798'],
    ['800', '+800'],
    ['801', '+801'],
    ['807', '+807'],
    ['826', '+826'],
    ['850', '+850'],
    ['852', '+852'],
    ['856', '+856'],
    ['860', '+860'],
    ['861', '+861'],
    ['863', '+863'],
    ['867', '+867'],
    ['868', '+868'],
    ['869', '+869'],
    ['870', '+870'],
    ['873', '+873'],
    ['880', '+880'],
    ['881', '+881'],
    ['882', '+882'],
    ['883', '+883'],
    ['886', '+886'],
    ['900', '+900'],
    ['901', '+901'],
    ['903', '+903'],
    ['905', '+905'],
    ['906', '+906'],
    ['909', '+909'],
    ['910', '+910'],
    ['911', '+911'],
    ['912', '+912'],
    ['913', '+913'],
    ['914', '+914'],
    ['916', '+916'],
    ['917', '+917'],
    ['918', '+918'],
    ['919', '+919'],
    ['920', '+920'],
    ['922', '+922'],
    ['923', '+923'],
    ['924', '+924'],
    ['925', '+925'],
    ['926', '+926'],
    ['927', '+927'],
    ['928', '+928'],
    ['929', '+929'],
    ['930', '+930'],
    ['931', '+931'],
    ['932', '+932'],
    ['933', '+933'],
    ['934', '+934'],
    ['935', '+935'],
    ['936', '+936'],
    ['937', '+937'],
    ['938', '+938'],
    ['939', '+939'],
    ['940', '+940'],
    ['941', '+941'],
    ['942', '+942'],
    ['943', '+943'],
    ['944', '+944'],
    ['945', '+945'],
    ['946', '+946'],
    ['947', '+947'],
    ['948', '+948'],
    ['949', '+949'],
    ['950', '+950'],
    ['951', '+951'],
    ['952', '+952'],
    ['953', '+953'],
    ['954', '+954'],
    ['955', '+955'],
    ['956', '+956'],
    ['957', '+957'],
    ['958', '+958'],
    ['959', '+959'],
    ['960', '+960'],
    ['961', '+961'],
    ['962', '+962'],
    ['963', '+963'],
    ['964', '+964'],
    ['965', '+965'],
    ['966', '+966'],
    ['967', '+967'],
    ['968', '+968'],
    ['969', '+969'],
    ['970', '+970'],
    ['971', '+971'],
    ['972', '+972'],
    ['973', '+973'],
    ['974', '+974'],
    ['975', '+975'],
    ['976', '+976'],
    ['977', '+977'],
    ['978', '+978'],
    ['979', '+979'],
    ['980', '+980'],
    ['981', '+981'],
    ['982', '+982'],
    ['983', '+983'],
    ['984', '+984'],
    ['985', '+985'],
    ['986', '+986'],
    ['987', '+987'],
    ['988', '+988'],
    ['989', '+989'],
  ]);

  private hasCountryIndicator(phone: string): boolean {
    const normalized = phone.replace(/[^0-9+]/g, '');
    if (normalized === '' || !/[+\d]/.test(normalized)) return false;
    if (normalized.startsWith('+')) return true;
    // Numéro international sans + : forme ex : "2370000000000" → indiqué que c'est French
    // Nous vparons la liste des codes pays (2-3 chiffres)
    for (const prefix of this.COUNTRY_INDICATORS.keys()) {
      if (normalized.startsWith(prefix)) return true;
    }
    return false;
  }

  async importExcel(buffer: Buffer, defaultIndicator?: string): Promise<ProspectImportResult & {
    needsIndicator?: boolean;
    indicatorCountry?: string;
    unmatchedPhoneValues?: string[];
  }> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let ignored = 0;
    const unmatchedPhoneValues: string[] = [];
    let matchedCountries: string[] = [];

    for (const row of jsonData) {
      const name = this.getString(row, ['Nom', 'name']).trim();
      const email = this.getString(row, ['Email', 'email'])
        .trim()
        .toLowerCase();
      let phone = this.getString(row, ['Telephone', 'phone']).trim();

      // Appliquer indicatif par défaut si nécessaire (avant recherche/ajout)
      if (phone && defaultIndicator && !this.hasCountryIndicator(phone)) {
        const indicatorValue = defaultIndicator.startsWith('+') ? defaultIndicator.slice(1) : defaultIndicator;
        phone = '+' + indicatorValue + phone.replace(/[^0-9]/g, '');
      }

      if (!email && !phone) {
        ignored++;
        continue;
      }

      const existing = await this.prospectModel
        .findOne({
          $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
        })
        .exec();

      if (existing) {
        const updateData: Record<string, unknown> = {};
        if (name && !existing.name) updateData.name = name;
        if (email && !existing.email) updateData.email = email;
        if (phone && !existing.phone) updateData.phone = phone;

        if (Object.keys(updateData).length > 0) {
          await this.prospectModel
            .findByIdAndUpdate(existing._id, updateData)
            .exec();
          updated++;
        } else {
          skipped++;
        }
      } else {
        try {
          await this.prospectModel.create({ name, email, phone });
          created++;
        } catch (error) {
          if (this.isDuplicateKeyError(error)) {
            skipped++;
          } else {
            throw error;
          }
        }
      }

      if (phone) {
        if (!this.hasCountryIndicator(phone)) {
          unmatchedPhoneValues.push(phone);
          matchedCountries = [...new Set([...matchedCountries, ...this.possibleCountries(phone)])];
        }
      }
    }

    if (unmatchedPhoneValues.length > 0) {
      return {
        totalRows: jsonData.length,
        created,
        updated,
        skipped,
        ignored,
        needsIndicator: true,
        indicatorCountry: matchedCountries[0] || undefined,
        unmatchedPhoneValues,
      };
    }

    return {
      totalRows: jsonData.length,
      created,
      updated,
      skipped,
      ignored,
    };
  }

  private possibleCountries(phone: string): string[] {
    const normalized = phone.replace(/[^0-9]/g, '');
    if (!/^\d{2,4}/.test(normalized)) return [];
    const matches: string[] = [];
    for (const code of this.COUNTRY_INDICATORS.keys()) {
      if (normalized.startsWith(code)) {
        matches.push(code);
      }
    }
    return matches;
  }

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Prospect introuvable');
    }
    return id;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
