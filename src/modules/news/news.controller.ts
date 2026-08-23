import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

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
  @Get('slug/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.newsService.findOneBySlug(slug);
  }

  // ---------- Back-office (admin) ----------
  @Get('all')
  @Roles('admin', 'superadmin')
  findAll(
    @Query() query: { page?: number; limit?: number; status?: string; search?: string },
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

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
