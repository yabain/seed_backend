import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsController } from './stats.controller';
import { PublicStatsController } from './public-stats.controller';
import { PublicStatsService } from './public-stats.service';
import { StatsService } from './stats.service';
import { PageView, PageViewSchema } from './schemas/page-view.schema';
import { Team, TeamSchema } from '../team/schemas/team.schema';
import { News, NewsSchema } from '../news/schemas/news.schema';
import { Resource, ResourceSchema } from '../resources/schemas/resource.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { RecruitmentCampaign, RecruitmentCampaignSchema } from '../recruitments/schemas/recruitment-campaign.schema';
import { RecruitmentApplication, RecruitmentApplicationSchema } from '../recruitments/schemas/recruitment-application.schema';
import { Program, ProgramSchema } from '../programs/schemas/program.schema';
import { Impact, ImpactSchema } from '../impacts/schemas/impact.schema';
import { Partner, PartnerSchema } from '../partners/schemas/partner.schema';
import { DonationMethod, DonationMethodSchema } from '../donations/schemas/donation-method.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PageView.name, schema: PageViewSchema },
      { name: Team.name, schema: TeamSchema },
      { name: News.name, schema: NewsSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: Event.name, schema: EventSchema },
      { name: RecruitmentCampaign.name, schema: RecruitmentCampaignSchema },
      {
        name: RecruitmentApplication.name,
        schema: RecruitmentApplicationSchema,
      },
      { name: Program.name, schema: ProgramSchema },
      { name: Impact.name, schema: ImpactSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: DonationMethod.name, schema: DonationMethodSchema },
    ]),
  ],
  controllers: [StatsController, PublicStatsController],
  providers: [StatsService, PublicStatsService],
  exports: [StatsService, PublicStatsService],
})
export class StatsModule {}
