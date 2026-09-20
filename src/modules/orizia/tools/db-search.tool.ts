/**
 * Outil « recherche_base » d'Orizia.
 *
 * Recherche d'informations publiques dans la base de données de l'UdM.
 * Ne concerne que les données **publiques** (actualités publiées, programmes,
 * ressources, événements, partenaires, équipe, page À propos, contacts officiels).
 * N'accède **jamais** aux données privées (prospects, candidatures, admins, etc.).
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from '../../news/schemas/news.schema';
import { Program, ProgramDocument } from '../../programs/schemas/program.schema';
import { Resource, ResourceDocument } from '../../resources/schemas/resource.schema';
import { Event, EventDocument } from '../../events/schemas/event.schema';
import { Partner, PartnerDocument } from '../../partners/schemas/partner.schema';
import { Team, TeamDocument } from '../../team/schemas/team.schema';
import { About, AboutDocument } from '../../about/schemas/about.schema';
import { SiteConfig, SiteConfigDocument } from '../../site/schemas/site-config.schema';

/** Résultat de recherche unifié. */
export interface DbSearchResult {
  type: 'news' | 'program' | 'resource' | 'event' | 'partner' | 'team' | 'about' | 'site';
  title: string;
  excerpt: string;
  url?: string;
  category?: string;
  date?: string;
}

@Injectable()
export class DbSearchTool {
  constructor(
    @InjectModel(News.name) private readonly newsModel: Model<NewsDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Resource.name) private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(Partner.name) private readonly partnerModel: Model<PartnerDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(About.name) private readonly aboutModel: Model<AboutDocument>,
    @InjectModel(SiteConfig.name) private readonly siteConfigModel: Model<SiteConfigDocument>,
  ) {}

  /**
   * Recherche multi-collections sur les données publiques.
   * Retourne les résultats les plus pertinents, limités.
   */
  async search(query: string, maxResults = 5): Promise<DbSearchResult[]> {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    const regex = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const filter = { $or: [{ title: { $regex: regex, $options: 'i' } }, { description: { $regex: regex, $options: 'i' } }, { content: { $regex: regex, $options: 'i' } }, { excerpt: { $regex: regex, $options: 'i' } }] };

    const limitPerCollection = Math.max(1, Math.ceil(maxResults / 6));

    const [news, programs, resources, events, partners, team, about, siteConfig] = await Promise.all([
      this.newsModel.find({ ...filter, status: 'published' }).sort({ publishedAt: -1 }).limit(limitPerCollection).lean(),
      this.programModel.find({ ...filter, isActive: true }).sort({ createdAt: -1 }).limit(limitPerCollection).lean(),
      this.resourceModel.find({ ...filter, isPublished: true }).sort({ createdAt: -1 }).limit(limitPerCollection).lean(),
      this.eventModel.find({ ...filter, isVisibleOnLanding: true }).sort({ startDate: -1 }).limit(limitPerCollection).lean(),
      this.partnerModel.find({ ...filter, isActive: true }).sort({ order: 1 }).limit(limitPerCollection).lean(),
      this.teamModel.find({ ...filter, isActive: true }).sort({ order: 1 }).limit(limitPerCollection).lean(),
      this.aboutModel.findOne().lean(),
      this.siteConfigModel.findOne().lean(),
    ]);

    const results: DbSearchResult[] = [];

    // Helper to safely convert Date to ISO string
    const toISO = (d?: Date | string | null | undefined): string | undefined =>
      d ? new Date(d).toISOString() : undefined;

    (news as any[]).forEach((n) =>
      results.push({
        type: 'news',
        title: n.title,
        excerpt: (n.excerpt || n.content || '').slice(0, 300),
        url: `/news/${n.slug || n._id}`,
        category: n.categories?.[0],
        date: toISO(n.publishedAt),
      }),
    );
    (programs as any[]).forEach((p) =>
      results.push({
        type: 'program',
        title: p.title,
        excerpt: (p.excerpt || p.description || '').slice(0, 300),
        url: `/programs/${p._id}`,
        date: toISO(p.createdAt),
      }),
    );
    (resources as any[]).forEach((r) =>
      results.push({
        type: 'resource',
        title: r.title,
        excerpt: (r.description || '').slice(0, 300),
        url: r.fileUrl,
        category: r.category,
        date: toISO(r.createdAt),
      }),
    );
    (events as any[]).forEach((e) =>
      results.push({
        type: 'event',
        title: e.title,
        excerpt: (e.description || '').slice(0, 300),
        url: `/events/${e._id}`,
        date: toISO(e.startDate),
      }),
    );
    (partners as any[]).forEach((p) =>
      results.push({
        type: 'partner',
        title: p.name,
        excerpt: p.description || '',
        url: p.website,
        date: toISO(p.createdAt),
      }),
    );
    team.forEach((t) =>
      (t.members || []).forEach((m) =>
        results.push({
          type: 'team',
          title: m.name,
          excerpt: m.role || m.description || '',
        }),
      ),
    );
    if (about) {
      const aboutText = [about.mission, about.vision, ...(about.values || [])].filter(Boolean).join(' ');
      if (terms.some((t) => aboutText.toLowerCase().includes(t))) {
        results.push({ type: 'about', title: 'À propos de l\'UdM', excerpt: aboutText.slice(0, 300), url: '/team' });
      }
    }
    if (siteConfig) {
      const siteText = [siteConfig.orgName, siteConfig.tagline, siteConfig.description, siteConfig.address, siteConfig.phone, siteConfig.email].filter(Boolean).join(' ');
      if (terms.some((t) => siteText.toLowerCase().includes(t))) {
        results.push({ type: 'site', title: siteConfig.orgName || 'Université des Montagnes', excerpt: siteText.slice(0, 300), url: '/contact' });
      }
    }

    return results.slice(0, maxResults);
  }
}