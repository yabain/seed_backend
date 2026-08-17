import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteConfig, SiteConfigDocument } from './schemas/site-config.schema';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

const DEFAULT_CONFIG = {
  orgName: 'SEED',
  tagline: '',
  description: '',
  logo: '',
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
    const config = await this.getOrCreate();

    config.set(dto);
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
}