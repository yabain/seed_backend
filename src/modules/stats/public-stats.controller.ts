import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import type { PublicStatsSummary } from './dto/public-stats-summary.dto';
import { PublicStatsService } from './public-stats.service';

@Public()
@Controller('public')
export class PublicStatsController {
  constructor(private readonly publicStatsService: PublicStatsService) {}

  @Get('stats')
  async getPublicStats(): Promise<PublicStatsSummary> {
    return this.publicStatsService.getPublicStats();
  }
}