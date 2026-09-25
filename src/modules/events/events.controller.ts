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
import { EventsService } from './events.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

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
