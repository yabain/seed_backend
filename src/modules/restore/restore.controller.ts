import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { RestoreService } from './restore.service';
import type { RestoreJob } from './restore.service';

const MAX_BACKUP_SIZE = 10 * 1024 * 1024 * 1024; // 10 Go

/** Décorateur : expose le body brut (multer olite les champs texte). */
export const BodyContent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.body ?? {};
  },
);

/** Répertoire temporaire pour les zips de restauration reçus. */
function tempDir(): string {
  const dir = join(process.cwd(), '.restore-tmp');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('restore')
export class RestoreController {
  constructor(private readonly restoreService: RestoreService) {}

  /**
   * Reçoit le fichier backup .zip et le stocke en temporaire. Renvoie un jobId.
   * Corps : multipart `file`, optionnellement `domain` (string).
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tempDir(),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '') || '.zip';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BACKUP_SIZE },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier de sauvegarde reçu.');
    }
    const jobId = randomUUID();
    this.restoreService.registerUpload(jobId, file.path);
    return { jobId, status: 'uploaded' };
  }

  /** Lance le traitement d'une sauvegarde reçue (domaine facultatif). */
  @Post(':jobId/apply')
  apply(
    @Param('jobId') jobId: string,
    @BodyContent() body: Record<string, unknown>,
  ) {
    const file = this.restoreService.getFilePath(jobId);
    if (!file) {
      throw new NotFoundException(
        'Sauvegarde introuvable (upload non effectué).',
      );
    }
    this.restoreService.runAsync(jobId, file, (body?.domain as string) || undefined);
    return { jobId, status: 'started' };
  }

  /** Interrogation de la progression du traitement. */
  @Get(':jobId/progress')
  progress(@Param('jobId') jobId: string): RestoreJob {
    const job = this.restoreService.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Traitement introuvable.');
    }
    return job;
  }
}