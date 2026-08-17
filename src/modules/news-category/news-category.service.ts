import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { NewsCategory, NewsCategoryDocument } from './schemas/news-category.schema';
import { CreateNewsCategoryDto, UpdateNewsCategoryDto } from './dto/news-category.dto';

@Injectable()
export class NewsCategoryService {
  constructor(
    @InjectModel(NewsCategory.name)
    private readonly newsCategoryModel: Model<NewsCategoryDocument>,
  ) {}

  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    const existing = await this.newsCategoryModel
      .findOne({ name: { $regex: new RegExp(`^${this.escapeRegExp(name)}$`, 'i') } })
      .exec();
    if (existing && existing._id.toString() !== excludeId) {
      throw new ConflictException('Cette catégorie existe déjà');
    }
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async create(dto: CreateNewsCategoryDto): Promise<NewsCategory> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);
    return this.newsCategoryModel.create({ name });
  }

  async findAll(): Promise<NewsCategory[]> {
    return this.newsCategoryModel.find().sort({ name: 1 }).lean().exec();
  }

  async update(id: string, dto: UpdateNewsCategoryDto): Promise<NewsCategory> {
    const realId = this.ensureId(id);
    const name = dto.name?.trim();
    if (name) {
      await this.assertNameAvailable(name, realId);
    }
    const category = await this.newsCategoryModel
      .findByIdAndUpdate(realId, { name }, { new: true })
      .lean()
      .exec();
    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return category;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.newsCategoryModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return { deleted: true };
  }

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return id;
  }
}