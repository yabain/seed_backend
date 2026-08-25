import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Program, ProgramDocument } from './schemas/program.schema';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program.name)
    private readonly programModel: Model<ProgramDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Programme introuvable');
    }
    return id;
  }

  async create(dto: CreateProgramDto): Promise<Program> {
    const program = new this.programModel(dto);
    return program.save();
  }

  async findAllPublic(): Promise<Program[]> {
    return this.programModel
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
    items: Program[];
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
        { excerpt: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.programModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.programModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Program> {
    const realId = this.ensureId(id);
    const program = await this.programModel.findById(realId).lean().exec();
    if (!program) {
      throw new NotFoundException('Programme introuvable');
    }
    return program;
  }

  async update(id: string, dto: UpdateProgramDto): Promise<Program> {
    const realId = this.ensureId(id);
    const program = await this.programModel
      .findByIdAndUpdate(realId, dto, { new: true })
      .lean()
      .exec();
    if (!program) {
      throw new NotFoundException('Programme introuvable');
    }
    return program;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.programModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Programme introuvable');
    }
    await deleteUploadFile(result.visual);
    await deleteUploadFile(result.icon);
    return { deleted: true };
  }
}
