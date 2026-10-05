import {
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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { NewsService } from './news.service';
import { SiteService } from '../site/site.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { Public } from '../../common/decorators/public.decorator';
import {
  normalizeMediaUrl,
  renderOgpPage,
  resolveOgpFrontendBase,
} from '../../common/utils/ogp.util';

@Controller('news')
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly configService: ConfigService,
    private readonly siteService: SiteService,
  ) {}

  // ---------- Espace public ----------
  @Public()
  @Get()
  findPublic(
    @Query() query: { page?: number; limit?: number; search?: string },
  ) {
    return this.newsService.findPublic(query);
  }

  @Public()
  @Get('latest')
  findLatest(@Query('limit') limit?: number) {
    return this.newsService.findLatest(limit ? Number(limit) : 3);
  }

  @Public()
  @Get('landing')
  findVisibleOnLanding(@Query('limit') limit?: number) {
    return this.newsService.findVisibleOnLanding(limit ? Number(limit) : 10);
  }

  @Public()
  @Get('slug/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.newsService.findOneBySlug(slug);
  }

  /** Page Open Graph servie aux robots sociaux pour `/news/:slug`. */
  @Public()
  @Get('ogp/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async renderOgp(@Param('slug') slug: string, @Req() req: Request) {
    const item = await this.newsService.findOneBySlug(slug);
    const id = item.slug || String((item as unknown as Record<string, unknown>)._id);
    const front = resolveOgpFrontendBase(
      req.query?.host as string | undefined,
      this.configService,
    );
    const url = `${front}/news/${encodeURIComponent(id)}`;
    const mediaOrigin =
      this.configService.get<string>('PUBLIC_URL') ||
      `${req.protocol}://${req.get('host')}`;
    const siteConfig = await this.siteService.getPublicConfig();
    return renderOgpPage({
      title: item.title,
      description: item.excerpt || item.content,
      image: normalizeMediaUrl(item.image, mediaOrigin),
      url,
      favicon: normalizeMediaUrl(siteConfig.favicon, mediaOrigin),
    });
  }

  // ---------- Back-office (admin) ----------
  @Get('all')
  @Roles('admin', 'superadmin')
  findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      archived?: 'all' | 'archived' | 'active';
    },
  ) {
    return this.newsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  // ---------- Back-office (admin) ----------
  @Post()
  @Roles('admin', 'superadmin')
  create(@Body() dto: CreateNewsDto) {
    return this.newsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @Patch(':id/toggle-archive')
  @Roles('admin', 'superadmin')
  toggleArchive(@Param('id') id: string) {
    return this.newsService.toggleArchive(id);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
