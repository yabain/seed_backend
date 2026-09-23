import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  VirtualTourSection,
  VirtualTourSectionDocument,
} from './schemas/virtual-tour-section.schema';
import { UpdateVirtualTourSectionDto } from './dto/update-virtual-tour-section.dto';

const DEFAULT_SECTION = {
  eyebrow: 'Virtual Tour',
  title: 'Visite virtuelle — 360°',
  subtitle:
    'Faites défiler nos espaces en 360°. Explorez les lieux à votre rythme, à la souris, au tactile ou plein écran.',
  url: '',
  visible: true,
};

@Injectable()
export class VirtualTourSectionService {
  constructor(
    @InjectModel(VirtualTourSection.name)
    private readonly model: Model<VirtualTourSectionDocument>,
  ) {}

  private async getOrCreate(): Promise<VirtualTourSectionDocument> {
    let section = await this.model.findOne().sort({ createdAt: 1 }).exec();
    if (!section) section = await this.model.create(DEFAULT_SECTION);
    return section;
  }

  async getPublic(): Promise<VirtualTourSection> {
    return (await this.getOrCreate()).toObject();
  }

  async update(dto: UpdateVirtualTourSectionDto): Promise<VirtualTourSection> {
    const section = await this.getOrCreate();
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) section.set(key as never, value);
    }
    await section.save();
    return section.toObject();
  }
}
