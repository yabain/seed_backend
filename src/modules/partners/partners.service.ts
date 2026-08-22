import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Partner, PartnerDocument } from './schemas/partner.schema';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Partenaire introuvable');
    }
    return id;
  }

  async create(dto: CreatePartnerDto): Promise<Partner> {
    const partner = new this.partnerModel(dto);
    return partner.save();
  }

  async findAllPublic(): Promise<Partner[]> {
    return this.partnerModel
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
    items: Partner[];
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
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { website: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.partnerModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.partnerModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Partner> {
    const realId = this.ensureId(id);
    const partner = await this.partnerModel.findById(realId).lean().exec();
    if (!partner) {
      throw new NotFoundException('Partenaire introuvable');
    }
    return partner;
  }

  async update(id: string, dto: UpdatePartnerDto): Promise<Partner> {
    const realId = this.ensureId(id);
    const partner = await this.partnerModel
      .findByIdAndUpdate(realId, dto, { new: true })
      .lean()
      .exec();
    if (!partner) {
      throw new NotFoundException('Partenaire introuvable');
    }
    return partner;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.partnerModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Partenaire introuvable');
    }
    return { deleted: true };
  }
}
