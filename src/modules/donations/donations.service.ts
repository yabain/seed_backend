import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DonationMethod, DonationMethodDocument } from './schemas/donation-method.schema';
import { CreateDonationMethodDto } from './dto/create-donation-method.dto';
import { UpdateDonationMethodDto } from './dto/update-donation-method.dto';

@Injectable()
export class DonationsService {
  constructor(
    @InjectModel(DonationMethod.name)
    private readonly donationMethodModel: Model<DonationMethodDocument>,
  ) {}

  async create(dto: CreateDonationMethodDto): Promise<DonationMethod> {
    const method = this.donationMethodModel.create(dto);
    return method;
  }

  async findAllActive(): Promise<DonationMethodDocument[]> {
    return this.donationMethodModel.find({ isActive: true }).sort({ order: 1 }).exec();
  }

  async findAll(): Promise<DonationMethodDocument[]> {
    return this.donationMethodModel.find().sort({ order: 1 }).exec();
  }

  async findOne(id: string): Promise<DonationMethodDocument> {
    const method = await this.donationMethodModel.findById(id).exec();
    if (!method) {
      throw new NotFoundException(`Méthode de don avec ID ${id} non trouvée`);
    }
    return method;
  }

  async update(id: string, dto: UpdateDonationMethodDto): Promise<DonationMethodDocument> {
    const method = await this.donationMethodModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!method) {
      throw new NotFoundException(`Méthode de don avec ID ${id} non trouvée`);
    }
    return method;
  }

  async toggleActive(id: string): Promise<DonationMethodDocument> {
    const method = await this.donationMethodModel.findById(id).exec();
    if (!method) {
      throw new NotFoundException(`Méthode de don avec ID ${id} non trouvée`);
    }
    method.isActive = !method.isActive;
    return method.save();
  }

  async delete(id: string): Promise<void> {
    const result = await this.donationMethodModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Méthode de don avec ID ${id} non trouvée`);
    }
  }
}