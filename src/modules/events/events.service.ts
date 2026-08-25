import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, isValidObjectId } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {}

  private ensureId(id: string): string {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Événement introuvable');
    }
    return id;
  }

  private computeStatus(startDate: Date, endDate: Date): 'soon' | 'currently' | 'ended' {
    const now = new Date();
    if (now < new Date(startDate)) return 'soon';
    if (now > new Date(endDate)) return 'ended';
    return 'currently';
  }

  @Cron('*/10 * * * * *')
  async handleStatusUpdate(): Promise<void> {
    try {
      const now = new Date();
      await this.eventModel.updateMany(
        { startDate: { $gt: now }, status: { $ne: 'soon' } },
        { $set: { status: 'soon' } },
      );
      await this.eventModel.updateMany(
        { startDate: { $lte: now }, endDate: { $gte: now }, status: { $ne: 'currently' } },
        { $set: { status: 'currently' } },
      );
      await this.eventModel.updateMany(
        { endDate: { $lt: now }, status: { $ne: 'ended' } },
        { $set: { status: 'ended' } },
      );
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour des statuts d\'événements', error);
    }
  }

  async create(dto: CreateEventDto): Promise<Event> {
    const event = new this.eventModel({
      ...dto,
      status: dto.status || this.computeStatus(
        new Date(dto.startDate),
        new Date(dto.endDate),
      ),
    });
    return event.save();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ items: Event[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { location: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findPublic(query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: Event[]; total: number; page: number; limit: number }> {
    return this.findAll({ ...query });
  }

  async findVisibleOnLanding(): Promise<Event[]> {
    return this.eventModel
      .find({ isVisibleOnLanding: true })
      .sort({ startDate: -1 })
      .limit(10)
      .lean()
      .exec();
  }

  async findLatest(limit = 3): Promise<Event[]> {
    const now = new Date();
    return this.eventModel
      .find({ isVisibleOnLanding: true, endDate: { $gte: now } })
      .sort({ startDate: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<Event> {
    const realId = this.ensureId(id);
    const event = await this.eventModel.findById(realId).lean().exec();
    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const realId = this.ensureId(id);
    const existing = await this.eventModel.findById(realId).exec();
    if (!existing) {
      throw new NotFoundException('Événement introuvable');
    }

    const updateData: Record<string, unknown> = { ...dto };

    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
      if (!dto.status) {
        updateData.status = this.computeStatus(startDate, endDate);
      }
    }

    const event = await this.eventModel
      .findByIdAndUpdate(realId, updateData, { new: true })
      .lean()
      .exec();
    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }
    return event;
  }

  async toggleVisibility(id: string): Promise<Event> {
    const realId = this.ensureId(id);
    const event = await this.eventModel.findById(realId).exec();
    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }
    event.isVisibleOnLanding = !event.isVisibleOnLanding;
    return event.save();
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const realId = this.ensureId(id);
    const result = await this.eventModel.findByIdAndDelete(realId).exec();
    if (!result) {
      throw new NotFoundException('Événement introuvable');
    }
    await deleteUploadFile(result.image);
    for (const panelist of result.panelists || []) {
      await deleteUploadFile(panelist.photo);
    }
    return { deleted: true };
  }
}
