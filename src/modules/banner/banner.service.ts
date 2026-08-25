import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument, BannerSlide } from './schemas/banner.schema';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannerService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
  ) {}

  private async getOrCreate(): Promise<BannerDocument> {
    let banner = await this.bannerModel.findOne().sort({ createdAt: 1 }).exec();
    if (!banner) {
      banner = await this.bannerModel.create({ slides: undefined });
    }
    return banner;
  }

  async getPublic(): Promise<Banner> {
    const banner = await this.getOrCreate();
    return banner.toObject();
  }

  async update(dto: UpdateBannerDto): Promise<Banner> {
    const banner = await this.getOrCreate();
    banner.slides = dto.slides.map((slide): BannerSlide => ({
      eyebrow: slide.eyebrow ?? '',
      title: slide.title ?? '',
      subtitle: slide.subtitle ?? '',
      image: slide.image ?? '',
    }));
    banner.fixedText = dto.fixedText ?? '';
    banner.rotatingPhrases = (dto.rotatingPhrases ?? []).slice(0, 10);
    banner.rotatingImage = dto.rotatingImage ?? '';
    await banner.save();
    return banner.toObject();
  }
}
