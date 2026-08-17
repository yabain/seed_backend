import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Partner, PartnerDocument } from './schemas/partner.schema';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

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

  async findAll(): Promise<Partner[]> {
    return this.partnerModel
      .find()
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();
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
