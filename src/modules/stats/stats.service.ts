import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageView, PageViewDocument } from './schemas/page-view.schema';
import { CreatePageViewDto } from './dto/create-page-view.dto';
import { RecruitmentApplication } from '../recruitments/schemas/recruitment-application.schema';

type Bucket = { date: string; pageViews: number; visits: number; shares: number };

/** Prépare un filtre `path` par préfixe (expression régulière échappée). */
function pathFilter(path?: string): Record<string, unknown> | null {
  const value = String(path || '').trim();
  if (!value) return null;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { path: { $regex: `^${escaped}` } };
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(PageView.name)
    private readonly pageViewModel: Model<PageViewDocument>,
    @InjectModel(RecruitmentApplication.name)
    private readonly applicationModel: Model<RecruitmentApplication>,
  ) {}

  async record(dto: CreatePageViewDto): Promise<void> {
    const type = dto.type === 'visit' ? 'visit' : 'pageview';

    if (type === 'visit') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const existing = await this.pageViewModel
        .findOne({
          visitorId: dto.visitorId,
          type: 'visit',
          createdAt: { $gte: startOfDay },
        })
        .exec();

      if (existing) {
        return;
      }
    }

    await this.pageViewModel.create({
      path: dto.path,
      visitorId: dto.visitorId,
      type,
      referrer: dto.referrer ?? '',
      userAgent: dto.userAgent ?? '',
    });
  }

  /** Enregistre un clic sur le bouton de partage d'un item. */
  async recordShare(dto: CreatePageViewDto): Promise<void> {
    await this.pageViewModel.create({
      path: dto.path,
      visitorId: dto.visitorId,
      type: 'share',
      referrer: dto.referrer ?? '',
      userAgent: dto.userAgent ?? '',
    });
  }

  async summary(): Promise<{
    totalPageViews: number;
    uniqueVisitors: number;
    todayPageViews: number;
    todayVisitors: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [pageViews, visitors, todayPageViews, todayVisitors] =
      await Promise.all([
        this.pageViewModel.countDocuments({ type: 'pageview' }).exec(),
        this.pageViewModel
          .distinct('visitorId', { type: 'visit' })
          .then((ids) => ids.length),
        this.pageViewModel
          .countDocuments({ type: 'pageview', createdAt: { $gte: startOfDay } })
          .exec(),
        this.pageViewModel
          .distinct('visitorId', {
            type: 'visit',
            createdAt: { $gte: startOfDay },
          })
          .then((ids) => ids.length),
      ]);

    return {
      totalPageViews: pageViews,
      uniqueVisitors: visitors,
      todayPageViews: todayPageViews,
      todayVisitors: todayVisitors,
    };
  }

  async dailySeries(
    days = 14,
    path?: string,
  ): Promise<Bucket[]> {
    const now = new Date();
    const startUtcMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (days - 1),
    );
    const start = new Date(startUtcMs);
    const filter = pathFilter(path) ?? {};

    const rows = await this.pageViewModel.aggregate<
      { _id: { type: string; iso: string }; count: number }
    >([
      { $match: { createdAt: { $gte: start }, ...filter } },
      {
        $group: {
          _id: {
            type: '$type',
            iso: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          },
          count: { $sum: 1 },
        },
      },
    ]).exec();

    const byDate: Record<
      string,
      { pageViews: number; visits: number; shares: number }
    > = {};
    for (let i = 0; i < days; i++) {
      const key = new Date(startUtcMs + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      byDate[key] = { pageViews: 0, visits: 0, shares: 0 };
    }

    for (const row of rows) {
      const entry = byDate[row._id.iso];
      if (!entry) continue;
      if (row._id.type === 'pageview') entry.pageViews += row.count;
      if (row._id.type === 'visit') entry.visits += row.count;
      if (row._id.type === 'share') entry.shares += row.count;
    }

    return Object.entries(byDate).map(([date, value]) => ({ date, ...value }));
  }

  async series(
    range: '24h' | '7d' | '30d' | '12m',
    path?: string,
  ): Promise<Bucket[]> {
    const fillBuckets = (
      map: Map<string, { pageViews: number; visits: number; shares: number }>,
      rows: Array<{ _id: { type: string; iso: string }; count: number }>,
    ) => {
      for (const row of rows) {
        const bucket = map.get(row._id.iso);
        if (!bucket) continue;
        if (row._id.type === 'pageview') bucket.pageViews += row.count;
        if (row._id.type === 'visit') bucket.visits += row.count;
        if (row._id.type === 'share') bucket.shares += row.count;
      }
      return [...map.entries()].map(([date, value]) => ({ date, ...value }));
    };

    const filter = pathFilter(path) ?? {};

    if (range === '24h') {
      const nowMs = Date.now();
      const startMs = Math.floor(nowMs / 3_600_000) * 3_600_000 - 23 * 3_600_000;
      const rows = await this.pageViewModel.aggregate<
        { _id: { type: string; iso: string }; count: number }
      >([
        { $match: { createdAt: { $gte: new Date(startMs) }, ...filter } },
        {
          $group: {
            _id: {
              type: '$type',
              iso: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
            },
            count: { $sum: 1 },
          },
        },
      ]).exec();

      const buckets = new Map<string, { pageViews: number; visits: number; shares: number }>();
      for (let i = 0; i < 24; i++) {
        const key = new Date(startMs + i * 3_600_000).toISOString().slice(0, 13);
        buckets.set(key, { pageViews: 0, visits: 0, shares: 0 });
      }
      return fillBuckets(buckets, rows);
    }

    if (range === '12m') {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
      const rows = await this.pageViewModel.aggregate<
        { _id: { type: string; iso: string }; count: number }
      >([
        { $match: { createdAt: { $gte: start }, ...filter } },
        {
          $group: {
            _id: {
              type: '$type',
              iso: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            },
            count: { $sum: 1 },
          },
        },
      ]).exec();

      const buckets = new Map<string, { pageViews: number; visits: number; shares: number }>();
      for (let i = 0; i < 12; i++) {
        const key = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
        )
          .toISOString()
          .slice(0, 7);
        buckets.set(key, { pageViews: 0, visits: 0, shares: 0 });
      }
      return fillBuckets(buckets, rows);
    }

    return this.dailySeries(range === '30d' ? 30 : 7, path);
  }

  async topPages(limit = 10): Promise<{ path: string; count: number }[]> {
    return this.pageViewModel.aggregate<{ _id: string; count: number }>([
      { $match: { type: 'pageview' } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]).exec().then((rows) =>
      rows.map((row) => ({ path: row._id, count: row.count })),
    );
  }

  /** Totaux d'un item (vues, partages, candidatures) par préfixe de chemin. */
  async itemStats(
    path: string,
  ): Promise<{ views: number; shares: number; applications: number }> {
    const filter = { path: { $regex: `^${String(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } };
    const [views, shares, applications] = await Promise.all([
      this.pageViewModel.countDocuments({ ...filter, type: 'pageview' }).exec(),
      this.pageViewModel.countDocuments({ ...filter, type: 'share' }).exec(),
      this.countApplicationsForPath(path),
    ]);
    return { views, shares, applications };
  }

  private async countApplicationsForPath(path: string): Promise<number> {
    const match = /^\/recruitments\/([^/?#]+)/.exec(String(path || ''));
    if (!match) return 0;
    return this.applicationModel.countDocuments({ campaignId: match[1] }).exec();
  }
}