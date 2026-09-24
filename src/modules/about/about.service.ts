import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { About, AboutDocument } from './schemas/about.schema';
import { UpdateAboutDto } from './dto/update-about.dto';

@Injectable()
export class AboutService {
  constructor(
    @InjectModel(About.name)
    private readonly aboutModel: Model<AboutDocument>,
  ) {}

  private async getOrCreate(): Promise<AboutDocument> {
    let about = await this.aboutModel.findOne().sort({ createdAt: 1 }).exec();
    if (!about) {
      about = await this.aboutModel.create({});
    }
    return about;
  }

  async getPublic(): Promise<About> {
    const about = await this.getOrCreate();
    return about.toObject();
  }

  async update(dto: UpdateAboutDto): Promise<About> {
    const about = await this.getOrCreate();
    if (dto.mission !== undefined) {
      about.mission = dto.mission;
    }
    if (dto.vision !== undefined) {
      about.vision = dto.vision;
    }
    if (dto.values !== undefined) {
      about.values = dto.values.map((value) => value ?? '');
    }
    if (dto.visual !== undefined) {
      about.visual = dto.visual;
    }
    if (dto.sectionEyebrow !== undefined) {
      about.sectionEyebrow = dto.sectionEyebrow;
    }
    if (dto.titleLine1 !== undefined) {
      about.titleLine1 = dto.titleLine1;
    }
    if (dto.titleLine2 !== undefined) {
      about.titleLine2 = dto.titleLine2;
    }
    if (dto.sectionDescription !== undefined) {
      about.sectionDescription = dto.sectionDescription;
    }
    if (dto.floatingCard1Icon !== undefined) {
      about.floatingCard1Icon = dto.floatingCard1Icon;
    }
    if (dto.floatingCard1Label !== undefined) {
      about.floatingCard1Label = dto.floatingCard1Label;
    }
    if (dto.floatingCard1Value !== undefined) {
      about.floatingCard1Value = dto.floatingCard1Value;
    }
    if (dto.floatingCard2Icon !== undefined) {
      about.floatingCard2Icon = dto.floatingCard2Icon;
    }
    if (dto.floatingCard2Label !== undefined) {
      about.floatingCard2Label = dto.floatingCard2Label;
    }
    if (dto.floatingCard2Value !== undefined) {
      about.floatingCard2Value = dto.floatingCard2Value;
    }
    await about.save();
    return about.toObject();
  }
}
