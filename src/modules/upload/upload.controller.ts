import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'webp',
  'image/png': 'webp',
  'image/gif': 'webp',
  'image/svg+xml': 'webp',
};

interface UploadedFileLike {
  mimetype: string;
  buffer: Buffer;
}

interface UploadBody {
  oldPath?: string;
}

/**
 * Upload d'image générique, accessible à tout utilisateur authentifié
 * (l'authentification est imposée globalement par JwtAuthGuard). Les `user` et
 * `consultant` devant pouvoir gérer du contenu (actualités, programmes,
 * ressources, événements) et modifier leur propre profil (photo), ils doivent
 * pouvoir uploader une image sans restriction de rôle.
 */
@Controller('admin/upload')
export class UploadController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }))
  async upload(
    @UploadedFile() file: UploadedFileLike,
    @Body() body: UploadBody,
    @Req() req: Request,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fichier manquant.');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }

    const extension = MIME_EXT[file.mimetype] ?? 'webp';
    const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;

    const uploadDir = resolveUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(join(uploadDir, name), file.buffer);

    if (body.oldPath) {
      await deleteUploadFile(body.oldPath);
    }

    const publicUrl = this.configService.get<string>('PUBLIC_URL');
    const origin = publicUrl || `${req.protocol}://${req.get('host')}`;
    return {
      url: `${origin.replace(/\/$/, '')}/uploads/${name}`,
      path: `/uploads/${name}`,
      fileName: undefined,
    };
  }
}