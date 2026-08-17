import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Resource, ResourceDocument } from './schemas/resource.schema';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Ressource introuvable');
    }
    return id;
  }

  async create(dto: CreateResourceDto): Promise<Resource> {
    const resource = new this.resourceModel(dto);
    return resource.save();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    isPublished?: boolean;
  }): Promise<{
    items: Resource[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    const filter: Record<string, unknown> = {};

    if (query.isPublished !== undefined) {
      filter.isPublished = query.isPublished;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.resourceModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.resourceModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findPublic(query: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<{
    items: Resource[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.findAll({
      ...query,
      category: query.category,
      isPublished: true,
    });
  }

  async findCategories(): Promise<string[]> {
    const categories = await this.resourceModel.distinct('category').exec();
    return categories.filter((c) => c).sort((a, b) => a.localeCompare(b));
  }

  async findOne(id: string): Promise<Resource> {
    const realId = this.ensureId(id);
    const resource = await this.resourceModel.findById(realId).lean().exec();
    if (!resource) {
      throw new NotFoundException('Ressource introuvable');
    }
    return resource;
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const realId = this.ensureId(id);
    const resource = await this.resourceModel
      .findByIdAndUpdate(realId, dto, { new: true })
      .lean()
      .exec();
    if (!resource) {
      throw new NotFoundException('Ressource introuvable');
    }
    return resource;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.resourceModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Ressource introuvable');
    }
    return { deleted: true };
  }
}
