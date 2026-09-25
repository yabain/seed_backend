import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ResourcesService } from './resources.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Public } from '../../common/decorators/public.decorator';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

const MAX_RESOURCE_UPLOAD_SIZE = 100 * 1024 * 1024;

const ALLOWED_RESOURCE_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const RESOURCE_MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

interface UploadedFileLike {
  mimetype: string;
  originalname: string;
  size: number;
  buffer: Buffer;
}

interface ResourceUploadBody {
  oldPath?: string;
}

@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly configService: ConfigService,
  ) {}

  // ---------- Espace public ----------
  @Public()
  @Get()
  findPublic(
    @Query() query: { page?: number; limit?: number; category?: string },
  ) {
    return this.resourcesService.findPublic(query);
  }

  @Public()
  @Get('categories')
  findCategories() {
    return this.resourcesService.findCategories();
  }

  @Get('all')
  @Roles('admin', 'superadmin')
  findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      isPublished?: string;
      archived?: 'all' | 'archived' | 'active';
    },
  ) {
    return this.resourcesService.findAll({
      ...query,
      isPublished:
        query.isPublished !== undefined
          ? query.isPublished === 'true'
          : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  // ---------- Back-office (admin) ----------
  /**
   * Upload du fichier d'une ressource (PDF, DOC, DOCX, XLS, XLSX),
   * limité à 100 Mo.
   */
  @Post('upload')
  @Roles('admin', 'superadmin')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_RESOURCE_UPLOAD_SIZE } }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedFileLike,
    @Body() body: ResourceUploadBody,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Fichier manquant.');
    }

    const mime = (file.mimetype ?? '').toLowerCase();
    if (
      !ALLOWED_RESOURCE_MIME.includes(
        mime as (typeof ALLOWED_RESOURCE_MIME)[number],
      )
    ) {
      throw new BadRequestException(
        'Type de fichier non autorisé (PDF, DOC, DOCX, XLS, XLSX).',
      );
    }

    const ext = RESOURCE_MIME_EXTENSIONS[mime] ?? 'bin';
    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = resolveUploadDir('resources');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(join(uploadDir, fileName), file.buffer);

    if (body.oldPath) {
      await deleteUploadFile(body.oldPath);
    }

    const publicUrl = this.configService.get<string>('PUBLIC_URL');
    const origin = publicUrl || `${req.protocol}://${req.get('host')}`;
    return {
      url: `${origin.replace(/\/$/, '')}/uploads/resources/${fileName}`,
      path: `/uploads/resources/${fileName}`,
      fileName: file.originalname,
      fileType: mime,
      fileSize: file.size,
    };
  }

  @Post()
  @Roles('admin', 'superadmin')
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Patch(':id/toggle-archive')
  @Roles('admin', 'superadmin')
  toggleArchive(@Param('id') id: string) {
    return this.resourcesService.toggleArchive(id);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}
