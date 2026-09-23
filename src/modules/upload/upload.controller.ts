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
import sharp from 'sharp';
import { join } from 'path';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

// 15 Mo : les photos HEIC/HEIF d'iPhone excèdent souvent les 5 Mo, il faut de la
// marge pour les recevoir en entier avant conversion serveur.
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const RAW_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/tiff': 'tiff',
  // HEIC/HEIF : format photo par défaut des iPhone. Enregistrés tels quels quand
  // `convert=false` (extension native), convertis en WebP par `sharp` sinon.
  'image/heic': 'heic',
  'image/heif': 'heif',
};

interface UploadedFileLike {
  mimetype: string;
  buffer: Buffer;
}

interface UploadBody {
  oldPath?: string;
  /**
   * 'false' conserve le format d'origine (extension + contenu bruts),
   * réservé au logo du site et aux images animées (GIF) non convertibles.
   */
  convert?: string;
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
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
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

    const convert = body.convert !== 'false' && body.convert !== '0';
    const extension = convert
      ? 'webp'
      : (RAW_EXT[file.mimetype] ?? file.mimetype.split('/')[1] ?? 'img');
    const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;

    const uploadDir = resolveUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    /*
     * Les photos HEIC/HEIF des iPhone ne sont pas décodables par tous les
     * navigateurs ; elles sont donc converties en WebP via `sharp` quand
     * `convert=true` (défaut). En cas d'échec de décodage, on conserve le
     * fichier brut avec son extension native pour ne jamais écrire un WebP
     * corrompu.
     */
    let storedBuffer = file.buffer;
    let effectiveExtension = extension;
    if (convert && (file.mimetype === 'image/heic' || file.mimetype === 'image/heif')) {
      try {
        storedBuffer = await sharp(file.buffer).rotate().webp({ quality: 82 }).toBuffer();
        effectiveExtension = 'webp';
      } catch {
        effectiveExtension = RAW_EXT[file.mimetype] ?? 'heic';
      }
    }
    await fs.writeFile(join(uploadDir, name), storedBuffer as unknown as Buffer);

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
