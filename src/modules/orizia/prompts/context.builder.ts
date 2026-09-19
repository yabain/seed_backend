import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { About, AboutDocument } from '../../about/schemas/about.schema';
import { DonationMethod, DonationMethodDocument } from '../../donations/schemas/donation-method.schema';
import { Event, EventDocument } from '../../events/schemas/event.schema';
import { FeaturesSection, FeaturesSectionDocument } from '../../features-section/schemas/features-section.schema';
import { Impact, ImpactDocument } from '../../impacts/schemas/impact.schema';
import { News, NewsDocument } from '../../news/schemas/news.schema';
import { Partner, PartnerDocument } from '../../partners/schemas/partner.schema';
import { Program, ProgramDocument } from '../../programs/schemas/program.schema';
import { Resource, ResourceDocument } from '../../resources/schemas/resource.schema';
import { SiteConfig, SiteConfigDocument } from '../../site/schemas/site-config.schema';
import { Team, TeamDocument } from '../../team/schemas/team.schema';

/** Longueur maximale d'un texte libre dans le contexte injecté. */
const MAX_TEXT = 500;

/** Budget total du bloc « CONTEXTE DYNAMIQUE » (en caractères). */
const MAX_TOTAL = 24_000;

/**
 * Construit le bloc « CONTEXTE DYNAMIQUE » fourni à Orizia : uniquement des
 * données **publiées et publiques**, extraites de la base du site.
 *
 * ⚠️ GARANTIE DE CONFIDENTIALITÉ — les modèles suivants ne sont **jamais**
 * interrogés ici, et ne doivent jamais l'être sans revue explicite des règles du
 * fichier `context_udm/00_identite_orizia.md` (section 4) :
 *   • ContactMessage        → messages du formulaire de contact (personnels)
 *   • Prospect              → candidats / prospects (personnels)
 *   • Admin / User          → comptes et utilisateurs (identifiants, e-mails)
 *   • AuditLog / UserLog    → journaux d'audit et d'activité
 *   • PasswordResetToken    → jetons de réinitialisation
 *   • TwoFactorCode         → codes de vérification à deux facteurs
 *   • PageView / stats      → statistiques d'audience détaillées
 *   • Smtp / EmailSettings  → configuration d'envoi d'e-mails
 *   • Announcement          → annonces internes (diffusion, planification)
 *   • DistributedLock       → verrous techniques
 * De plus, les champs sensibles des modèles publics sont exclus par projection
 * `select(...)` : e-mails et téléphones des partenaires, réseaux sociaux et
 * photos des membres de l'équipe.
 */
@Injectable()
export class OriziaContextBuilder {
  constructor(
    @InjectModel(SiteConfig.name) private readonly siteConfigModel: Model<SiteConfigDocument>,
    @InjectModel(About.name) private readonly aboutModel: Model<AboutDocument>,
    @InjectModel(News.name) private readonly newsModel: Model<NewsDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Resource.name) private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Partner.name) private readonly partnerModel: Model<PartnerDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(Impact.name) private readonly impactModel: Model<ImpactDocument>,
    @InjectModel(FeaturesSection.name) private readonly featuresModel: Model<FeaturesSectionDocument>,
    @InjectModel(DonationMethod.name) private readonly donationModel: Model<DonationMethodDocument>,
  ) {}

  /** Retourne le bloc dynamique complet, prêt à être injecté dans le prompt. */
  async build(): Promise<string> {
    const [site, about, news, events, programs, resources, partners, team, impacts, features, donations] =
      await Promise.all([
        this.siteConfigModel.findOne().sort({ createdAt: 1 }).lean().catch(() => null),
        this.aboutModel.findOne().lean().catch(() => null),
        this.newsModel
          .find({ status: 'published' })
          .sort({ publishedAt: -1, createdAt: -1 })
          .limit(15)
          .select('title slug excerpt publishedAt')
          .lean()
          .catch(() => []),
        this.eventModel
          .find()
          .sort({ startDate: -1 })
          .limit(12)
          .select('title startDate endDate status location description')
          .lean()
          .catch(() => []),
        this.programModel
          .find({ isActive: true })
          .sort({ order: 1 })
          .limit(20)
          .select('title excerpt description')
          .lean()
          .catch(() => []),
        this.resourceModel
          .find({ isPublished: true })
          .sort({ createdAt: -1 })
          .limit(25)
          .select('title category description fileName')
          .lean()
          .catch(() => []),
        this.partnerModel
          .find({ isActive: true })
          .sort({ order: 1 })
          .limit(30)
          .select('name website description')
          .lean()
          .catch(() => []),
        this.teamModel.findOne().lean().catch(() => null),
        this.impactModel
          .find({ isActive: true })
          .sort({ order: 1 })
          .limit(20)
          .select('title metric subtitle description')
          .lean()
          .catch(() => []),
        this.featuresModel.findOne().lean().catch(() => null),
        this.donationModel
          .find({ isActive: true })
          .sort({ order: 1 })
          .select('name details paymentLink')
          .lean()
          .catch(() => []),
      ]);

    const parts: string[] = [];
    this.pushOrganisation(parts, site);
    this.pushAbout(parts, about);
    this.pushImpacts(parts, impacts);
    this.pushFeatures(parts, features);
    this.pushPrograms(parts, programs);
    this.pushNews(parts, news);
    this.pushEvents(parts, events);
    this.pushResources(parts, resources);
    this.pushTeam(parts, team);
    this.pushPartners(parts, partners);
    this.pushDonations(parts, donations);

    const body = parts.filter(Boolean).join('\n');
    if (!body.trim()) {
      return "Aucune donnée publique n'est disponible dans la base du site pour le moment.";
    }
    return body.length > MAX_TOTAL
      ? `${body.slice(0, MAX_TOTAL)}\n[... contexte tronqué ...]`
      : body;
  }

  // ------------------------------------------------------------- sections

  private pushOrganisation(parts: string[], site: any): void {
    if (!site) return;
    const lines: string[] = [];
    if (site.orgName) lines.push(`Nom : ${site.orgName}`);
    if (site.tagline) lines.push(`Accroche : ${site.tagline}`);
    if (site.description) lines.push(`Description : ${this.truncate(site.description, MAX_TEXT)}`);
    if (site.heroTitle) lines.push(`Titre de la page d'accueil : ${site.heroTitle}`);
    if (site.heroSubtitle) lines.push(`Sous-titre : ${this.truncate(site.heroSubtitle, MAX_TEXT)}`);
    if (site.address) lines.push(`Adresse : ${site.address}`);
    if (site.phone) lines.push(`Téléphone : ${site.phone}`);
    if (site.phone2) lines.push(`Téléphone secondaire : ${site.phone2}`);
    if (site.email) lines.push(`E-mail de contact : ${site.email}`);
    const social = site.social ?? {};
    const socials = Object.entries(social)
      .filter(([, url]) => typeof url === 'string' && url.trim())
      .map(([key, url]) => `${key} : ${url}`);
    if (socials.length) lines.push(`Réseaux sociaux : ${socials.join(' | ')}`);
    if (!lines.length) return;
    parts.push(`### IDENTITÉ DE L'INSTITUTION\n${lines.join('\n')}`);
  }

  private pushAbout(parts: string[], about: any): void {
    if (!about) return;
    const lines: string[] = [];
    if (about.mission) lines.push(`Mission : ${this.truncate(about.mission, MAX_TEXT)}`);
    if (about.vision) lines.push(`Vision : ${this.truncate(about.vision, MAX_TEXT)}`);
    const values = (about.values ?? []).filter((value: string) => value?.trim());
    if (values.length) lines.push(`Valeurs : ${values.join(' • ')}`);
    if (!lines.length) return;
    parts.push(`### MISSION, VISION ET VALEURS\n${lines.join('\n')}`);
  }

  private pushImpacts(parts: string[], impacts: any[]): void {
    if (!impacts?.length) return;
    const lines = impacts.map((impact) => {
      const value = [impact.metric, impact.title].filter(Boolean).join(' — ');
      const detail = impact.subtitle || impact.description;
      return `- ${value}${detail ? ` : ${this.truncate(detail, 240)}` : ''}`;
    });
    parts.push(`### CHIFFRES D'IMPACT (données publiées par l'institution)\n${lines.join('\n')}`);
  }

  private pushFeatures(parts: string[], features: any): void {
    if (!features) return;
    const lines: string[] = [];
    if (features.title) lines.push(`Titre : ${features.title}`);
    if (features.description) lines.push(`Description : ${this.truncate(features.description, MAX_TEXT)}`);
    const items = (features.features ?? []).filter((item: any) => item?.name);
    if (items.length) {
      lines.push("Points d'engagement :");
      for (const item of items) {
        lines.push(
          `- ${item.name}${item.details ? ` : ${this.truncate(item.details, 240)}` : ''}`,
        );
      }
    }
    if (!lines.length) return;
    parts.push(`### AXES D'ENGAGEMENT\n${lines.join('\n')}`);
  }

  private pushPrograms(parts: string[], programs: any[]): void {
    if (!programs?.length) return;
    const lines = programs.map((program) => {
      const summary = program.excerpt || program.description || program.content;
      return `- ${program.title}${summary ? ` : ${this.truncate(summary, 300)}` : ''}`;
    });
    parts.push(`### PROGRAMMES ET PROJETS ACTIFS\n${lines.join('\n')}`);
  }

  private pushNews(parts: string[], news: any[]): void {
    if (!news?.length) return;
    const lines = news.map((item) => {
      const date = item.publishedAt ? ` (${this.formatDate(item.publishedAt)})` : '';
      const summary = item.excerpt ? ` : ${this.truncate(item.excerpt, 260)}` : '';
      const slug = item.slug ? ` — route : /news/${item.slug}` : '';
      return `- ${item.title}${date}${summary}${slug}`;
    });
    parts.push(`### ACTUALITÉS PUBLIÉES (les plus récentes)\n${lines.join('\n')}`);
  }

  private pushEvents(parts: string[], events: any[]): void {
    if (!events?.length) return;
    const labels: Record<string, string> = {
      soon: 'à venir',
      currently: 'en cours',
      ended: 'terminé',
    };
    const lines = events.map((event) => {
      const period =
        event.startDate && event.endDate
          ? `du ${this.formatDate(event.startDate)} au ${this.formatDate(event.endDate)}`
          : '';
      const status = labels[event.status] ?? event.status ?? '';
      const place = event.location ? ` — lieu : ${event.location}` : '';
      const summary = event.description ? ` — ${this.truncate(event.description, 240)}` : '';
      return `- ${event.title} (${status}) ${period}${place}${summary}`;
    });
    parts.push(`### ÉVÉNEMENTS\n${lines.join('\n')}`);
  }

  private pushResources(parts: string[], resources: any[]): void {
    if (!resources?.length) return;
    const lines = resources.map((resource) => {
      const category = resource.category ? ` [${resource.category}]` : '';
      const summary = resource.description ? ` : ${this.truncate(resource.description, 240)}` : '';
      const file = resource.fileName ? ` — fichier : ${resource.fileName}` : '';
      return `- ${resource.title}${category}${summary}${file}`;
    });
    parts.push(
      `### RESSOURCES DOCUMENTAIRES PUBLIÉES (disponibles sur la page /resources)\n${lines.join('\n')}`,
    );
  }

  private pushTeam(parts: string[], team: any): void {
    if (!team) return;
    const sections = (team.sections ?? []).filter((section: any) => section?.isActive !== false && section?.title);
    const members = (team.members ?? []).filter((member: any) => member?.isActive !== false && member?.name);
    if (!sections.length && !members.length) return;

    const lines: string[] = [];
    if (sections.length) {
      lines.push(`Organisation de l'équipe : ${sections.map((s: any) => s.title).join(' • ')}`);
    }
    if (members.length) {
      lines.push('Membres :');
      for (const member of members) {
        const role = member.role ? ` — ${member.role}` : '';
        const description = member.description ? ` : ${this.truncate(member.description, 200)}` : '';
        lines.push(`- ${member.name}${role}${description}`);
      }
    }
    parts.push(`### ÉQUIPE\n${lines.join('\n')}`);
  }

  private pushPartners(parts: string[], partners: any[]): void {
    if (!partners?.length) return;
    const lines = partners.map((partner) => {
      const website = partner.website ? ` — ${partner.website}` : '';
      const summary = partner.description ? ` : ${this.truncate(partner.description, 200)}` : '';
      return `- ${partner.name}${summary}${website}`;
    });
    parts.push(`### PARTENAIRES\n${lines.join('\n')}`);
  }

  private pushDonations(parts: string[], donations: any[]): void {
    if (!donations?.length) return;
    const lines = donations.map((method) => {
      const details = method.details ? ` : ${this.truncate(method.details, 240)}` : '';
      return `- ${method.name}${details}`;
    });
    parts.push(
      `### MOYENS DE SOUTIEN PROPOSÉS (la page /contact peut être utilisée pour toute question)\n${lines.join('\n')}`,
    );
  }

  // ------------------------------------------------------------------ utils

  private formatDate(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  private truncate(value: unknown, max: number): string {
    const text = this.clean(value);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  private clean(value: unknown): string {
    return String(value ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
