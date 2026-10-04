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
import { EventsService } from './events.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Public } from '../../common/decorators/public.decorator';
import {
  buildFrontendUrl,
  normalizeMediaUrl,
  renderOgpPage,
} from '../../common/utils/ogp.util';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  findPublic(
    @Query() query: { page?: number; limit?: number; search?: string },
  ) {
    return this.eventsService.findPublic(query);
  }

  @Public()
  @Get('landing')
  findVisibleOnLanding() {
    return this.eventsService.findVisibleOnLanding();
  }

  @Public()
  @Get('latest')
  findLatest(@Query('limit') limit?: number) {
    return this.eventsService.findLatest(limit ? Number(limit) : 3);
  }

  /** Page Open Graph servie aux robots sociaux pour `/events/:id`. */
  @Public()
  @Get('ogp/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async renderOgp(@Param('id') id: string, @Req() req: Request) {
    const item = await this.eventsService.findOne(id);
    const ref = String((item as unknown as Record<string, unknown>)._id);
    const url = `${buildFrontendUrl(this.configService)}/events/${encodeURIComponent(ref)}`;
    const mediaOrigin =
      this.configService.get<string>('PUBLIC_URL') ||
      `${req.protocol}://${req.get('host')}`;
    return renderOgpPage({
      title: item.title,
      description: item.description,
      image: normalizeMediaUrl(item.image, mediaOrigin),
      url,
    });
  }

  @Get('all')
  @Roles('admin', 'superadmin')
  findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      archived?: 'all' | 'archived' | 'active';
    },
  ) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'superadmin')
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(':id/toggle-visibility')
  @Roles('admin', 'superadmin')
  toggleVisibility(@Param('id') id: string) {
    return this.eventsService.toggleVisibility(id);
  }

  @Patch(':id/toggle-archive')
  @Roles('admin', 'superadmin')
  toggleArchive(@Param('id') id: string) {
    return this.eventsService.toggleArchive(id);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
