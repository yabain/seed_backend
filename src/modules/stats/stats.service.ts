import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageView, PageViewDocument } from './schemas/page-view.schema';
import { CreatePageViewDto } from './dto/create-page-view.dto';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(PageView.name)
    private readonly pageViewModel: Model<PageViewDocument>,
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
  ): Promise<{ date: string; pageViews: number; visits: number }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await this.pageViewModel
      .aggregate<{ _id: { type: string; iso: string }; count: number }>([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              type: '$type',
              iso: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const byDate: Record<string, { pageViews: number; visits: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      byDate[date.toISOString().slice(0, 10)] = { pageViews: 0, visits: 0 };
    }

    for (const row of rows) {
      const key = row._id.iso;
      if (byDate[key]) {
        if (row._id.type === 'pageview') {
          byDate[key].pageViews += row.count;
        }
        if (row._id.type === 'visit') {
          byDate[key].visits += row.count;
        }
      }
    }

    return Object.entries(byDate).map(([date, value]) => ({ date, ...value }));
  }

  async topPages(limit = 10): Promise<{ path: string; count: number }[]> {
    return this.pageViewModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { type: 'pageview' } },
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec()
      .then((rows) => rows.map((row) => ({ path: row._id, count: row.count })));
  }
}
