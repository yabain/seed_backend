import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prospect, ProspectDocument } from './prospect.schema';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';
import { MailService } from '../mail/mail.service';
import { renderEmailLayout, escapeHtml } from '../mail/templates/layout';
import { SiteService } from '../site/site.service';

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

@Injectable()
export class ProspectsService {
  private readonly logger = new Logger(ProspectsService.name);

  constructor(
    @InjectModel(Prospect.name)
    private readonly prospectModel: Model<ProspectDocument>,
    private readonly mailService: MailService,
    private readonly siteService: SiteService,
  ) {}

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
      logo: siteConfig.logo,
      orgName: siteConfig.orgName,
      social: siteConfig.social,
    };

    const html = renderEmailLayout({
      title: `Bienvenue chez ${siteConfig.orgName?.trim() || 'notre organisation'}`,
      preheader: "Merci de vous être inscrit à notre lettre d'information.",
      contentHtml: `
        <p>Bonjour <strong>${escapeHtml(prospect.name || '')}</strong>,</p>
        <p>Merci de vous être inscrit à notre lettre d'information. Vous recevrez bientôt nos actualités.</p>
        <p style="margin:18px 0 0;color:#64748b;font-size:14px;">
          Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.
        </p>
      `,
      branding,
    });

    await this.mailService.send({
      to: prospect.email,
      subject: `Bienvenue chez ${siteConfig.orgName?.trim() || 'notre organisation'} — Lettre d'information`,
      html,
    });
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
            ? raw.createdAt.toISOString().split('T')[0]
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

    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
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

  async importExcel(buffer: Buffer): Promise<{
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    ignored: number;
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

    for (const row of jsonData) {
      const name = this.getString(row, ['Nom', 'name']).trim();
      const email = this.getString(row, ['Email', 'email'])
        .trim()
        .toLowerCase();
      const phone = this.getString(row, ['Telephone', 'phone']).trim();

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
    }

    return { totalRows: jsonData.length, created, updated, skipped, ignored };
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
