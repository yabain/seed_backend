import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteConfig, SiteConfigDocument } from './schemas/site-config.schema';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

const MEDIA_KEYS: readonly string[] = ['logo', 'favicon', 'ogImage'];

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
};

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(SiteConfig.name)
    private readonly siteConfigModel: Model<SiteConfigDocument>,
  ) {}

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
    await config.save();
    return config.toObject();
  }

  private hasMeaningfulPayload(dto: UpdateSiteConfigDto): boolean {
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    const isMediaReset =
      entries.length > 0 &&
      entries.every(
        ([key, value]) =>
          MEDIA_KEYS.includes(key) &&
          typeof value === 'string' &&
          value.trim() === '',
      );
    if (isMediaReset) {
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