import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { News, NewsDocument } from './schemas/news.schema';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name) private readonly newsModel: Model<NewsDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Actualité introuvable');
    }
    return id;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === 11000
    );
  }

  private async uniqueSlug(
    base: string | undefined,
    excludeId?: string,
  ): Promise<string | undefined> {
    if (!base) {
      return undefined;
    }
    const filter: { slug: RegExp; _id?: { $ne: string } } = {
      slug: new RegExp(`^${escapeRegExp(base)}(?:-([0-9]+))?$`),
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const rows = await this.newsModel
      .find(filter)
      .select('slug')
      .lean()
      .exec();
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) {
      return base;
    }
    let counter = 2;
    while (taken.has(`${base}-${counter}`)) {
      counter += 1;
    }
    return `${base}-${counter}`;
  }

  async create(dto: CreateNewsDto): Promise<News> {
    const base = dto.slug || slugify(dto.title) || undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const news = new this.newsModel({
        ...dto,
        slug: await this.uniqueSlug(base),
        publishedAt: dto.status === 'published' ? new Date() : undefined,
      });
      try {
        return await news.save();
      } catch (error) {
        if (this.isDuplicateKeyError(error)) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Un conflit de slug est survenu, réessayez.');
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ items: News[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { excerpt: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.newsModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.newsModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findPublic(query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: News[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.findAll({ ...query, status: 'published' });
  }

  async findLatest(limit = 3): Promise<News[]> {
    return this.newsModel
      .find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<News> {
    const realId = this.ensureId(id);
    const news = await this.newsModel.findById(realId).lean().exec();
    if (!news) {
      throw new NotFoundException('Actualité introuvable');
    }
    return news;
  }

  async findOneBySlug(slug: string): Promise<News> {
    const news = await this.newsModel
      .findOne({ slug, status: 'published' })
      .lean()
      .exec();
    if (!news) {
      throw new NotFoundException('Actualité introuvable');
    }
    return news;
  }

  async update(id: string, dto: UpdateNewsDto): Promise<News> {
    const realId = this.ensureId(id);
    const existing = await this.newsModel.findById(realId).exec();
    if (!existing) {
      throw new NotFoundException('Actualité introuvable');
    }
    const updateData: UpdateNewsDto & { publishedAt?: Date } = { ...dto };
    if (dto.status === 'published') {
      updateData.publishedAt = new Date();
    }
    if (dto.slug && dto.slug !== existing.slug) {
      updateData.slug = await this.uniqueSlug(dto.slug, realId);
    }
    const news = await this.newsModel
      .findByIdAndUpdate(realId, updateData, { new: true })
      .lean()
      .exec();
    if (!news) {
      throw new NotFoundException('Actualité introuvable');
    }
    return news;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.newsModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Actualité introuvable');
    }
    return { deleted: true };
  }
}
