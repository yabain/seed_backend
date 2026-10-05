import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { RecruitmentsService } from './recruitments.service';
import { SiteService } from '../site/site.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  normalizeMediaUrl,
  renderOgpPage,
  resolveOgpFrontendBase,
} from '../../common/utils/ogp.util';
import { CreateRecruitmentCampaignDto } from './dto/create-recruitment-campaign.dto';
import { UpdateRecruitmentCampaignDto } from './dto/update-recruitment-campaign.dto';
import { CreateRecruitmentApplicationDto } from './dto/create-recruitment-application.dto';
import { UpdateRecruitmentApplicationStatusDto } from './dto/update-recruitment-application-status.dto';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

const MAX_RECRUITMENT_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

interface UploadedFileLike {
  mimetype: string;
  originalname: string;
  size: number;
  buffer: Buffer;
}

interface RecruitmentUploadBody {
  oldPath?: string;
}

@Controller('recruitments')
export class RecruitmentsController {
  constructor(
    private readonly recruitmentsService: RecruitmentsService,
    private readonly configService: ConfigService,
    private readonly siteService: SiteService,
  ) {}

  @Public()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_RECRUITMENT_UPLOAD_SIZE },
    }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedFileLike,
    @Body() body: RecruitmentUploadBody,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Fichier manquant.');
    }

    const mime = (file.mimetype ?? '').toLowerCase();
    if (!ALLOWED_UPLOAD_MIME.includes(mime as (typeof ALLOWED_UPLOAD_MIME)[number])) {
      throw new BadRequestException(
        'Type de fichier non autorisé (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, PNG, WEBP, GIF).',
      );
    }

    const ext = MIME_EXTENSIONS[mime] ?? 'bin';
    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = resolveUploadDir('recruitments');
    await fs.mkdir(uploadDir, { recursive: true });

    const fullPath = join(uploadDir, fileName);
    await fs.writeFile(fullPath, file.buffer);

    if (body.oldPath) {
      await deleteUploadFile(body.oldPath);
    }

    const publicUrl = this.configService.get<string>('PUBLIC_URL');
    const origin = publicUrl || `${req.protocol}://${req.get('host')}`;
    return {
      url: `${origin.replace(/\/$/, '')}/uploads/recruitments/${fileName}`,
      path: `/uploads/recruitments/${fileName}`,
      fileName: file.originalname,
      fileType: mime,
      fileSize: file.size,
    };
  }

  // ---------- Espace public ----------
  @Public()
  @Get()
  findPublic(
    @Query() query: { page?: number; limit?: number; search?: string },
  ) {
    return this.recruitmentsService.findPublicCampaigns(query);
  }

  @Public()
  @Get('landing')
  findVisibleOnLanding(@Query('limit') limit?: number) {
    return this.recruitmentsService.findVisibleOnLanding(limit ? Number(limit) : 10);
  }

  /** Page Open Graph servie aux robots sociaux pour `/recruitments/:id`. */
  @Public()
  @Get('ogp/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async renderOgp(@Param('id') id: string, @Req() req: Request) {
    const item = await this.recruitmentsService.findPublicCampaignById(id);
    const ref = String((item as unknown as Record<string, unknown>)._id);
    const front = resolveOgpFrontendBase(
      req.query?.host as string | undefined,
      this.configService,
    );
    const url = `${front}/recruitments/${encodeURIComponent(ref)}`;
    const mediaOrigin =
      this.configService.get<string>('PUBLIC_URL') ||
      `${req.protocol}://${req.get('host')}`;
    const siteConfig = await this.siteService.getPublicConfig();
    return renderOgpPage({
      title: item.title,
      description: item.description || item.contentHtml,
      image: normalizeMediaUrl(item.image, mediaOrigin),
      url,
      favicon: normalizeMediaUrl(siteConfig.favicon, mediaOrigin),
    });
  }

  // ---------- Back-office ----------
  @Get('admin/all')
  @Roles('admin', 'superadmin', 'consultant', 'user')
  findAllAdmin(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: 'published' | 'archived' | 'all';
    },
  ) {
    return this.recruitmentsService.findAdminCampaigns(query);
  }

  @Post('admin')
  @Roles('admin', 'superadmin')
  createCampaign(@Body() dto: CreateRecruitmentCampaignDto) {
    return this.recruitmentsService.createCampaign(dto);
  }

  @Get('admin/:id')
  @Roles('admin', 'superadmin', 'consultant', 'user')
  findOneAdmin(@Param('id') id: string) {
    return this.recruitmentsService.findCampaignById(id);
  }

  @Patch('admin/:id')
  @Roles('admin', 'superadmin')
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateRecruitmentCampaignDto,
  ) {
    return this.recruitmentsService.updateCampaign(id, dto);
  }

  @Patch('admin/:id/toggle-status')
  @Roles('admin', 'superadmin')
  toggleCampaignStatus(@Param('id') id: string) {
    return this.recruitmentsService.toggleCampaignStatus(id);
  }

  @Post('admin/:id/duplicate')
  @Roles('admin', 'superadmin')
  duplicateCampaign(@Param('id') id: string) {
    return this.recruitmentsService.duplicateCampaign(id);
  }

  @Delete('admin/:id')
  @Roles('admin', 'superadmin')
  removeCampaign(@Param('id') id: string) {
    return this.recruitmentsService.removeCampaign(id);
  }

  @Get('admin/:id/applications')
  @Roles('admin', 'superadmin', 'consultant', 'user')
  findCampaignApplications(
    @Param('id') id: string,
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: 'pending' | 'approved' | 'rejected' | 'all';
    },
  ) {
    return this.recruitmentsService.findCampaignApplications(id, query);
  }

  @Get('admin/applications/:id')
  @Roles('admin', 'superadmin', 'consultant', 'user')
  findApplication(@Param('id') id: string) {
    return this.recruitmentsService.findApplicationById(id);
  }

  @Patch('admin/applications/:id/status')
  @Roles('admin', 'superadmin', 'consultant')
  updateApplicationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRecruitmentApplicationStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.recruitmentsService.updateApplicationStatus(id, dto, {
      id: currentUser.id,
      role: currentUser.role,
    });
  }

  @Public()
  @Get(':id')
  findOnePublic(@Param('id') id: string) {
    return this.recruitmentsService.findPublicCampaignById(id);
  }

  @Public()
  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @Body() dto: CreateRecruitmentApplicationDto,
  ) {
    return this.recruitmentsService.createApplication(id, dto);
  }
}
