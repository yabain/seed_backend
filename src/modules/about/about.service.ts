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
    await about.save();
    return about.toObject();
  }
}
