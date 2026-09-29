import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { PublicStatsSummary } from './dto/public-stats-summary.dto';
import { News, NewsDocument } from '../news/schemas/news.schema';
import { Resource, ResourceDocument } from '../resources/schemas/resource.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
import {
  RecruitmentCampaign,
  RecruitmentCampaignDocument,
} from '../recruitments/schemas/recruitment-campaign.schema';
import { Program, ProgramDocument } from '../programs/schemas/program.schema';
import { Impact, ImpactDocument } from '../impacts/schemas/impact.schema';
import { Partner, PartnerDocument } from '../partners/schemas/partner.schema';
import { DonationMethod, DonationMethodDocument } from '../donations/schemas/donation-method.schema';
import { Team, TeamDocument } from '../team/schemas/team.schema';

@Injectable()
export class PublicStatsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<NewsDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(RecruitmentCampaign.name)
    private readonly campaignModel: Model<RecruitmentCampaignDocument>,
    @InjectModel(Program.name)
    private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Impact.name)
    private readonly impactModel: Model<ImpactDocument>,
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
    @InjectModel(DonationMethod.name)
    private readonly donationModel: Model<DonationMethodDocument>,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
  ) {}

  async getPublicStats(): Promise<PublicStatsSummary> {
    // Content counts (public/published/active only)
    const [
      newsCount,
      resourcesCount,
      eventsCount,
      recruitmentsCount,
      programsCount,
      impactsCount,
      partnersCount,
      donationsCount,
      teamsCount,
    ] = await Promise.all([
      this.newsModel.countDocuments({
        status: 'published',
        isArchived: { $ne: true },
      }).exec(),
      this.resourceModel.countDocuments({
        isPublished: true,
        isArchived: { $ne: true },
      }).exec(),
      this.eventModel.countDocuments({ isArchived: { $ne: true } }).exec(),
      this.campaignModel.countDocuments({
        status: 'published',
        endsAt: { $gte: new Date() },
      }).exec(),
      this.programModel.countDocuments({ isActive: true }).exec(),
      this.impactModel.countDocuments({ isActive: true }).exec(),
      this.partnerModel.countDocuments({ isActive: true }).exec(),
      this.donationModel.countDocuments({ isActive: true }).exec(),
// For teams, count active sections and active members
      this.teamModel
        .aggregate([
          {
            $project: {
              activeSections: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$sections', []] },
                    as: 's',
                    cond: { $eq: ['$$s.isActive', true] },
                  },
                },
              },
              activeMembers: {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$members', []] },
                    as: 'm',
                    cond: { $eq: ['$$m.isActive', true] },
                  },
                },
              },
            },
          },
          { $group: { _id: null, activeSections: { $sum: '$activeSections' }, activeMembers: { $sum: '$activeMembers' } } },
        ])
        .then((result) => {
          const first = result[0] as { activeSections?: number; activeMembers?: number } | undefined;
          const sum = (first?.activeSections ?? 0) + (first?.activeMembers ?? 0);
          return sum;
        })
        .catch(() => 0),
    ]);

    return {
      totalPageViews: 0,
      uniqueVisitors: 0,
      todayPageViews: 0,
      todayVisitors: 0,
      newsCount,
      resourcesCount,
      eventsCount,
      recruitmentsCount,
      programsCount,
      impactsCount,
      partnersCount,
      donationsCount,
      teamsCount,
    };
  }
}