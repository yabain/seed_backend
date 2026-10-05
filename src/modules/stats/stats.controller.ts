import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PublicStatsService } from './public-stats.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CreatePageViewDto } from './dto/create-page-view.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly publicStatsService: PublicStatsService,
  ) {}

  @Public()
  @Post('visit')
  record(@Body() dto: CreatePageViewDto) {
    return this.statsService.record(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('share')
  recordShare(@Body() dto: CreatePageViewDto) {
    return this.statsService.recordShare(dto);
  }

  @Get('summary')
  summary() {
    return this.statsService.summary();
  }

  // Compteurs actifs/publiés destinés au dashboard des utilisateurs non-admin.
  @Get('public-dashboard')
  @Roles('user', 'consultant', 'admin', 'superadmin')
  publicDashboard() {
    return this.publicStatsService.getPublicStats();
  }

  @Get('daily')
  daily(@Query('days') days?: string) {
    return this.statsService.dailySeries(days ? Number(days) || 14 : 14);
  }

  @Get('series')
  series(@Query('range') range?: string, @Query('path') path?: string) {
    const allowed = ['24h', '7d', '30d', '12m'] as const;
    type Range = (typeof allowed)[number];
    const value: Range = allowed.includes(range as Range)
      ? (range as Range)
      : '7d';
    return this.statsService.series(value, path);
  }

  @Get('item-stats')
  itemStats(@Query('path') path?: string) {
    return this.statsService.itemStats(path || '');
  }

  @Get('top-pages')
  topPages(@Query('limit') limit?: string) {
    return this.statsService.topPages(limit ? Number(limit) || 10 : 10);
  }
}
