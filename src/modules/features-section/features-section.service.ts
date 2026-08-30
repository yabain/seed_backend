import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeaturesSection, FeaturesSectionDocument, FeatureItem } from './schemas/features-section.schema';
import { UpdateFeaturesSectionDto } from './dto/update-features-section.dto';

@Injectable()
export class FeaturesSectionService {
  constructor(
    @InjectModel(FeaturesSection.name)
    private readonly featuresSectionModel: Model<FeaturesSectionDocument>,
  ) {}

  private async getOrCreate(): Promise<FeaturesSectionDocument> {
    let section = await this.featuresSectionModel.findOne().sort({ createdAt: 1 }).exec();
    if (!section) {
      section = await this.featuresSectionModel.create({ features: undefined });
    }
    return section;
  }

  async getPublic(): Promise<FeaturesSection> {
    const section = await this.getOrCreate();
    return section.toObject();
  }

  async update(dto: UpdateFeaturesSectionDto): Promise<FeaturesSection> {
    const section = await this.getOrCreate();
    if (dto.eyebrow !== undefined) section.eyebrow = dto.eyebrow;
    if (dto.title !== undefined) section.title = dto.title;
    if (dto.description !== undefined) section.description = dto.description;
    if (dto.image !== undefined) section.image = dto.image;
    if (dto.visible !== undefined) section.visible = dto.visible;
    if (dto.features !== undefined) {
      section.features = dto.features.map((f): FeatureItem => ({
        icon: f.icon ?? '',
        name: f.name ?? '',
        details: f.details ?? '',
      }));
    }
    await section.save();
    return section.toObject();
  }
}
