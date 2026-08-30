import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VideoHighlightSection, VideoHighlightSectionDocument } from './schemas/video-highlight-section.schema';
import { UpdateVideoHighlightSectionDto } from './dto/update-video-highlight-section.dto';

const DEFAULT_SECTION = { eyebrow: '', title: '', description: '', buttonLabel: 'En savoir plus', buttonLink: '', videoUrl: '', visible: true };

@Injectable()
export class VideoHighlightSectionService {
  constructor(@InjectModel(VideoHighlightSection.name) private readonly model: Model<VideoHighlightSectionDocument>) {}
  private async getOrCreate(): Promise<VideoHighlightSectionDocument> {
    let section = await this.model.findOne().sort({ createdAt: 1 }).exec();
    if (!section) section = await this.model.create(DEFAULT_SECTION);
    return section;
  }
  async getPublic(): Promise<VideoHighlightSection> { return (await this.getOrCreate()).toObject(); }
  async update(dto: UpdateVideoHighlightSectionDto): Promise<VideoHighlightSection> {
    const section = await this.getOrCreate();
    for (const [key, value] of Object.entries(dto)) if (value !== undefined) section.set(key, value);
    await section.save();
    return section.toObject();
  }
}
