import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Avis, AvisDocument } from './schemas/avis.schema';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class AvisService {
  constructor(
    @InjectModel(Avis.name) private readonly avisModel: Model<AvisDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Avis introuvable');
    }
    return id;
  }

  async create(dto: CreateAvisDto): Promise<Avis> {
    const avis = new this.avisModel(dto);
    return avis.save();
  }

  /** Liste publique (section home) : actifs uniquement, triés. */
  async findAllPublic(): Promise<Avis[]> {
    return this.avisModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: Avis[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const filter: Record<string, unknown> = {};

    const search = (query.search ?? '').trim();
    if (search) {
      const escaped = escapeRegExp(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { role: { $regex: escaped, $options: 'i' } },
        { reviewText: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.avisModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.avisModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Avis> {
    const realId = this.ensureId(id);
    const avis = await this.avisModel.findById(realId).lean().exec();
    if (!avis) {
      throw new NotFoundException('Avis introuvable');
    }
    return avis;
  }

  async update(id: string, dto: UpdateAvisDto): Promise<Avis> {
    const realId = this.ensureId(id);
    const avis = await this.avisModel
      .findByIdAndUpdate(realId, dto, { new: true })
      .lean()
      .exec();
    if (!avis) {
      throw new NotFoundException('Avis introuvable');
    }
    return avis;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const before = await this.avisModel.findById(realId).exec();
    if (!before) {
      throw new NotFoundException('Avis introuvable');
    }
    await this.avisModel.findByIdAndDelete(realId).exec();
    // Nettoie la photo uploadée (comme pour l'équipe).
    await deleteUploadFile(before.photo);
    return { deleted: true };
  }
}