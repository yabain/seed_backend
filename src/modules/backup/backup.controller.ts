import { Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { BackupService } from './backup.service';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * Génère une sauvegarde complète (base + uploads + contexte Orizia) et la
   * télécharge en streaming sous le nom BackupWebsite_<date>_<heure>.zip.
   */
  @Post()
  async create(@Res({ passthrough: false }) res: Response): Promise<void> {
    const { stream, filename } = await this.backupService.createBackup();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      stream.pipe(res);
    });
  }
}