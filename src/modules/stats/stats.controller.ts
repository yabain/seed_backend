import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { CreatePageViewDto } from './dto/create-page-view.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Post('visit')
  record(@Body() dto: CreatePageViewDto) {
    return this.statsService.record(dto);
  }

  @Get('summary')
  summary() {
    return this.statsService.summary();
  }

  @Get('daily')
  daily(@Query('days') days?: string) {
    return this.statsService.dailySeries(days ? Number(days) || 14 : 14);
  }

  @Get('top-pages')
  topPages(@Query('limit') limit?: string) {
    return this.statsService.topPages(limit ? Number(limit) || 10 : 10);
  }
}
