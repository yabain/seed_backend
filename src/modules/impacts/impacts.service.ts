import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Impact, ImpactDocument } from './schemas/impact.schema';
import { CreateImpactDto } from './dto/create-impact.dto';
import { UpdateImpactDto } from './dto/update-impact.dto';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ImpactsService {
  constructor(
    @InjectModel(Impact.name)
    private readonly impactModel: Model<ImpactDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Impact introuvable');
    }
    return id;
  }

  async create(dto: CreateImpactDto): Promise<Impact> {
    const impact = new this.impactModel(dto);
    return impact.save();
  }

  async findAllPublic(): Promise<Impact[]> {
    return this.impactModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: Impact[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const filter: Record<string, unknown> = {};

    const search = (query.search ?? '').trim();
    if (search) {
      const escaped = escapeRegExp(search);
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { metric: { $regex: escaped, $options: 'i' } },
        { subtitle: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.impactModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.impactModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Impact> {
    const realId = this.ensureId(id);
    const impact = await this.impactModel.findById(realId).lean().exec();
    if (!impact) {
      throw new NotFoundException('Impact introuvable');
    }
    return impact;
  }

  async update(id: string, dto: UpdateImpactDto): Promise<Impact> {
    const realId = this.ensureId(id);
    const impact = await this.impactModel
      .findByIdAndUpdate(realId, dto, { new: true })
      .lean()
      .exec();
    if (!impact) {
      throw new NotFoundException('Impact introuvable');
    }
    return impact;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.impactModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Impact introuvable');
    }
    await deleteUploadFile(result.visual);
    await deleteUploadFile(result.icon);
    return { deleted: true };
  }
}
