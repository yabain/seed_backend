import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import { basename, extname, join } from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { UpdateAnnouncementSettingsDto } from './dto/update-settings.dto';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

@Roles('admin', 'superadmin')
@Controller('admin/announcements')
export class AnnouncementsController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly configService: ConfigService,
  ) {}

  /* ------------------------------- LISTE ---------------------------- */

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('group') group?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.announcementsService.findAll({
      status,
      group,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  async getStats() {
    return this.announcementsService.getStats();
  }

  /* ------------------------------ RÉGLAGES -------------------------- */

  @Get('settings')
  async getSettings() {
    return this.announcementsService.getSettings();
  }

  @Put('settings')
  async updateSettings(@Body() dto: UpdateAnnouncementSettingsDto) {
    return this.announcementsService.updateSettings(dto);
  }

  /* ----------------------------- PIÈCES JOINTES --------------------- */

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_SIZE } }),
  )
  async uploadAttachment(
    @UploadedFile() file?: { mimetype: string; originalname: string; buffer: Buffer },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Fichier manquant.');
    }

    const safeName =
      basename(file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_') ||
      'piece-jointe';
    const extension = extname(safeName);
    const stem = basename(safeName, extension).slice(0, 80) || 'fichier';
    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${stem.trim().replace(/\s+/g, '-')}${extension}`;

    await fs.mkdir(resolveUploadDir('announcements'), { recursive: true });
    await fs.writeFile(
      join(resolveUploadDir('announcements'), fileName),
      file.buffer,
    );

    const publicUrl = this.configService.get<string>('PUBLIC_URL');
    const relativePath = `/uploads/announcements/${fileName}`;

    return {
      url: `${(publicUrl ?? '').replace(/\/$/, '')}${relativePath}`,
      path: relativePath,
      fileName: safeName,
      size: file.buffer.length,
    };
  }

  /* ------------------------------- APERÇU --------------------------- */

  @Post('preview')
  preview(@Body() body: { bodyHtml?: string; includeHeader?: boolean; includeFooter?: boolean }) {
    return this.announcementsService.preview(
      body?.bodyHtml ?? '',
      body?.includeHeader ?? true,
      body?.includeFooter ?? true,
    );
  }

  /* ------------------------------- CRUD ----------------------------- */

  @Post()
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }

  /* ------------------------------ ACTIONS --------------------------- */

  @Post(':id/send')
  sendNow(@Param('id') id: string) {
    return this.announcementsService.sendNow(id);
  }

  @Post(':id/schedule')
  schedule(@Param('id') id: string, @Body() body: { scheduledAt: string }) {
    return this.announcementsService.schedule(id, body?.scheduledAt ?? '');
  }

  @Post(':id/cancel-schedule')
  cancelSchedule(@Param('id') id: string) {
    return this.announcementsService.cancelSchedule(id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.announcementsService.duplicate(id);
  }
}
