import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';

export interface RecordAuditInput {
  actorId?: string | null;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
  metadata?: Record<string, unknown>;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        actorId: input.actorId || null,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        resourceLabel: input.resourceLabel,
        metadata: input.metadata,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to persist audit log: ${message}`);
    }
  }

  async list(
    page = 1,
    limit = 20,
    filters?: {
      q?: string;
      action?: string;
      actionPrefix?: string;
      resourceType?: string;
      resourceId?: string;
      actorId?: string;
      actorRole?: string;
      statusCode?: string;
      method?: string;
      ip?: string;
      from?: string;
      to?: string;
      sort?: string;
    },
  ) {
    const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, Number(limit)))
      : 20;
    const skip = (safePage - 1) * safeLimit;

    const filter: Record<string, unknown> = {};

    if (filters?.action) filter.action = filters.action;
    if (filters?.actionPrefix) {
      const escaped = filters.actionPrefix.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      filter.action = new RegExp(`^${escaped}`, 'i');
    }
    if (filters?.resourceType) filter.resourceType = filters.resourceType;
    if (filters?.resourceId) filter.resourceId = filters.resourceId;
    if (filters?.actorId) filter.actorId = filters.actorId;
    if (filters?.actorRole) filter.actorRole = filters.actorRole;
    if (filters?.statusCode) filter.statusCode = Number(filters.statusCode);
    if (filters?.method) filter.method = String(filters.method).toUpperCase();
    if (filters?.ip) {
      const escaped = filters.ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.ip = new RegExp(escaped, 'i');
    }

    if (filters?.q) {
      const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const qRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { action: qRegex },
        { actorEmail: qRegex },
        { resourceLabel: qRegex },
        { resourceId: qRegex },
        { path: qRegex },
      ];
    }

    if (filters?.from || filters?.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) {
        const from = new Date(filters.from);
        if (!Number.isNaN(from.getTime())) createdAt.$gte = from;
      }
      if (filters.to) {
        const to = new Date(filters.to);
        if (!Number.isNaN(to.getTime())) createdAt.$lte = to;
      }
      if (Object.keys(createdAt).length) filter.createdAt = createdAt;
    }

    const sortDir = filters?.sort === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: sortDir })
        .skip(skip)
        .limit(safeLimit),
      this.auditLogModel.countDocuments(filter),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;
    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasPrevPage: safePage > 1,
        hasNextPage: totalPages > 0 && safePage < totalPages,
      },
    };
  }

  async distinctActions(prefix?: string, limit = 50): Promise<string[]> {
    const match: Record<string, unknown> = {};
    if (prefix) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.action = new RegExp(`^${escaped}`, 'i');
    }
    const result = await this.auditLogModel.aggregate([
      { $match: match },
      { $group: { _id: '$action' } },
      { $sort: { _id: 1 } },
      { $limit: Math.min(limit, 200) },
    ]);
    return result.map((r: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return r._id as string;
    });
  }

  async distinctResourceTypes(): Promise<string[]> {
    const result = await this.auditLogModel.aggregate([
      { $match: { resourceType: { $exists: true, $ne: '' } } },
      { $group: { _id: '$resourceType' } },
      { $sort: { _id: 1 } },
    ]);
    return result.map((r: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return r._id as string;
    });
  }
}
