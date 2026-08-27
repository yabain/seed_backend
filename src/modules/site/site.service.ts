import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteConfig, SiteConfigDocument } from './schemas/site-config.schema';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { resolvePublicMediaUrl } from '../../utils/public-media-url.util';

const MEDIA_KEYS: readonly string[] = ['logo', 'favicon', 'ogImage'];

const COLOR_KEYS: readonly string[] = ['primaryColor', 'secondaryColor'];

const SCALAR_KEYS = [
  'orgName',
  'tagline',
  'description',
  'logo',
  'favicon',
  'ogImage',
  'heroTitle',
  'heroSubtitle',
  'address',
  'phone',
  'phone2',
  'email',
  'primaryColor',
  'secondaryColor',
] as const;

const DEFAULT_CONFIG = {
  orgName: 'SEED',
  tagline: '',
  description: '',
  logo: '',
  favicon: '',
  ogImage: '',
  heroTitle: '',
  heroSubtitle: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  primaryColor: '',
  secondaryColor: '',
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    youtube: '',
  },
  segments: {
    news: true,
    resources: true,
    programs: true,
    partners: true,
  },
  landingSections: {
    events: { eyebrow: 'Événements', title: 'Nos rendez-vous', description: 'Retrouvez nos événements à venir et passés.' },
    news: { eyebrow: 'Actualités', title: 'Nos dernières nouvelles', description: 'Suivez notre actualité et nos réalisations.' },
    programs: { eyebrow: 'Nos actions', title: 'Programmes et projets actifs', description: 'Des initiatives concrètes portées avec nos partenaires.' },
    partners: { eyebrow: '', title: '', description: '' },
  },
};

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(SiteConfig.name)
    private readonly siteConfigModel: Model<SiteConfigDocument>,
    private readonly configService: ConfigService,
  ) {}

  resolveMediaUrl(url?: string): string {
    const base =
      this.configService.get<string>('PUBLIC_URL') ?? 'http://localhost:3000';
    return resolvePublicMediaUrl(url, base);
  }

  private async getOrCreate(): Promise<SiteConfigDocument> {
    let config = await this.siteConfigModel.findOne().sort({ createdAt: 1 }).exec();

    if (!config) {
      return this.siteConfigModel.create({ ...DEFAULT_CONFIG });
    }

    let changed = false;
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      const current = config.get(key);
      if (current === undefined || current === null) {
        config.set(key, typeof value === 'object' ? { ...value } : value);
        changed = true;
      }
    }
    if (changed) {
      await config.save();
    }
    return config;
  }

  async getPublicConfig(): Promise<SiteConfig> {
    const config = await this.getOrCreate();
    return config.toObject();
  }

  async update(dto: UpdateSiteConfigDto): Promise<SiteConfig> {
    if (!this.hasMeaningfulPayload(dto)) {
      throw new BadRequestException(
        'Payload vide : aucune donnée à mettre à jour.',
      );
    }

    const config = await this.getOrCreate();

    config.set(this.compact(dto));
    if (dto.social) {
      config.set('social', {
        ...DEFAULT_CONFIG.social,
        ...(config.social ?? {}),
        ...dto.social,
      });
    }
    if (dto.segments) {
      config.set('segments', {
        ...DEFAULT_CONFIG.segments,
        ...(config.segments ?? {}),
        ...dto.segments,
      });
    }
    if (dto.landingSections) {
      config.set('landingSections', {
        ...DEFAULT_CONFIG.landingSections,
        ...(config.landingSections ?? {}),
        ...dto.landingSections,
      });
    }
    await config.save();
    return config.toObject();
  }

  private hasMeaningfulPayload(dto: UpdateSiteConfigDto): boolean {
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    const isReset =
      entries.length > 0 &&
      entries.every(
        ([key, value]) =>
          (MEDIA_KEYS.includes(key) || COLOR_KEYS.includes(key)) &&
          typeof value === 'string' &&
          value.trim() === '',
      );
    if (isReset) {
      return true;
    }

    const hasScalar = SCALAR_KEYS.some((key) => {
      const value = dto[key];
      return typeof value === 'string' && value.trim().length > 0;
    });
    if (hasScalar) {
      return true;
    }
    if (
      dto.social &&
      Object.values(dto.social).some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      )
    ) {
      return true;
    }
    if (dto.segments && Object.values(dto.segments).some((value) => typeof value === 'boolean')) {
      return true;
    }
    if (dto.landingSections && Object.values(dto.landingSections).some((section) =>
      section && Object.values(section).some((value) => typeof value === 'string'),
    )) {
      return true;
    }
    return false;
  }

  private compact(dto: UpdateSiteConfigDto): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    return patch;
  }
}
