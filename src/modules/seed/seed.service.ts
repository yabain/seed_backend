import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Admin, AdminDocument } from '../auth/schemas/admin.schema';
import { News, NewsDocument } from '../news/schemas/news.schema';
import {
  Resource,
  ResourceDocument,
} from '../resources/schemas/resource.schema';
import { Program, ProgramDocument } from '../programs/schemas/program.schema';
import { Partner, PartnerDocument } from '../partners/schemas/partner.schema';
import {
  SiteConfig,
  SiteConfigDocument,
} from '../site/schemas/site-config.schema';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(News.name) private readonly newsModel: Model<NewsDocument>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<ResourceDocument>,
    @InjectModel(Program.name)
    private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
    @InjectModel(SiteConfig.name)
    private readonly siteConfigModel: Model<SiteConfigDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Vérification des données initiales…');
    await this.seedAdmin();
    await this.seedSiteConfig();
    await this.seedNews();
    await this.seedResources();
    await this.seedPrograms();
    await this.seedPartners();
  }

  private async seedAdmin(): Promise<void> {
    const count = await this.adminModel.countDocuments().exec();
    if (count > 0) {
      return;
    }

    const email =
      this.configService.get<string>('ADMIN_EMAIL') ?? 'flambel55@gmail.com';
    const password =
      this.configService.get<string>('ADMIN_PASSWORD') ?? 'admin1234';
    const name = 'Administrateur';

    const hashed = await bcrypt.hash(password, 10);
    await this.adminModel.create({
      email,
      password: hashed,
      name,
      role: 'superadmin',
      notifyContact: true,
    });
    this.logger.warn(
      `✅ Compte administrateur créé -> ${email} / ${password} (superadmin)`,
    );
  }

  private async seedSiteConfig(): Promise<void> {
    const count = await this.siteConfigModel.countDocuments().exec();
    if (count > 0) {
      return;
    }
    await this.siteConfigModel.create({
      orgName: 'Organisation',
      tagline: '',
      description:
        '',
      logo: '',
      heroTitle: 'Construisons un avenir durable et solidaire',
      heroSubtitle:
        '',
      address: '',
      phone: '',
      email: '',
      social: {},
    });
    this.logger.log('✅ Configuration du site créée');
  }

  private async seedNews(): Promise<void> {
    const count = await this.newsModel.countDocuments().exec();
    if (count > 0) {
      return;
    }
    const now = Date.now();
    const items: Array<Partial<News>> = [
      {
        title:
          'Lancement d’un programme d’éducation environnementale dans les écoles',
        excerpt:
          'Un programme novateur pour sensibiliser les élèves dès le plus jeune âge à la protection de l’environnement.',
        content:
          "Ce programme pilote, déployé dans une dizaine d'établissements, vise à éduquer les élèves aux gestes éco-responsables, au tri des déchets et à la préservation de la biodiversité. Des sessions pratiques de jardinage et de recyclage sont proposées tout au long de l'année scolaire.\n\nL'objectif est d'intégrer durablement les valeurs environnementales dans le cursus scolaire et au sein des foyers.",
        image: '',
        tags: ['éducation', 'environnement'],
        status: 'published',
        publishedAt: new Date(now - 3 * 86400000),
      },
      {
        title: 'Atelier de sensibilisation au développement durable réussi',
        excerpt:
          'Plus de 120 participants ont pris part à notre atelier sur les enjeux climatiques et les solutions locales.',
        content:
          "Notre atelier organisé ce week-end a rassemblé étudiants, entrepreneurs et membres de la communauté autour des défis du développement durable. Des solutions concrètes ont été présentées, allant de l'agriculture urbaine aux énergies renouvelables.",
        image: '',
        tags: ['développement durable', 'atelier'],
        status: 'published',
        publishedAt: new Date(now - 12 * 86400000),
      },
      {
        title:
          'Partenariat signé avec une entreprise locale pour le reboisement',
        excerpt:
          'Un partenariat de 3 ans pour planter 10 000 arbres dans la région.',
        content:
          "Signature d'un partenariat ambitieux visant la plantation de 10 000 arbres sur trois ans. Cette initiative s'inscrit dans une mission de lutte contre la déforestation et de restauration des écosystèmes locaux.",
        image: '',
        tags: ['partenariat', 'environnement'],
        status: 'published',
        publishedAt: new Date(now - 25 * 86400000),
      },
    ];

    await this.newsModel.insertMany(items);
    this.logger.log(`✅ ${items.length} actualités de démonstration créées`);
  }

  private async seedResources(): Promise<void> {
    const count = await this.resourceModel.countDocuments().exec();
    if (count > 0) {
      return;
    }
    await this.resourceModel.insertMany([
      {
        title: 'Rapport annuel 2024',
        category: 'Rapports',
        description: 'Le rapport d’activité complet pour l’année 2024.',
        fileUrl: '',
        fileName: 'rapport-annuel-2024.pdf',
        fileType: 'application/pdf',
        fileSize: 0,
        isPublished: true,
      },
      {
        title: 'Présentation institutionnelle',
        category: 'Brochures',
        description:
          'Découvrez notre vision et nos domaines d’intervention.',
        fileUrl: '',
        fileName: 'presentation-institutionnelle.pdf',
        fileType: 'application/pdf',
        fileSize: 0,
        isPublished: true,
      },
      {
        title: 'Note de plaidoyer : éducation pour tous',
        category: 'Rapports',
        description:
          'Nos recommandations pour une éducation inclusive et durable.',
        fileUrl: '',
        fileName: 'plaidoyer-education.pdf',
        fileType: 'application/pdf',
        fileSize: 0,
        isPublished: true,
      },
      {
        title: 'Guide des bonnes pratiques environnementales',
        category: 'Guides',
        description:
          'Un guide pratique à destination des écoles et des familles.',
        fileUrl: '',
        fileName: 'guide-bonnes-pratiques.pdf',
        fileType: 'application/pdf',
        fileSize: 0,
        isPublished: true,
      },
    ]);
    this.logger.log('✅ Ressources de démonstration créées');
  }

  private async seedPrograms(): Promise<void> {
    const count = await this.programModel.countDocuments().exec();
    if (count > 0) {
      return;
    }
    await this.programModel.insertMany([
      {
        title: 'Éducation & Émancipation',
        excerpt:
          'Programmes éducatifs pour l’égalité des chances et la réussite des jeunes.',
        description:
          'Nous développons des programmes éducatifs novateurs (bourses, tutorats, écoles communautaires) pour offrir à chaque jeune les clés de sa réussite et de son émancipation.',
        icon: 'education',
        visual: '',
        order: 1,
        isActive: true,
      },
      {
        title: 'Environnement & Climat',
        excerpt:
          'Protection de l’environnement et actions climatiques concrètes.',
        description:
          'Reboisement, gestion des déchets, énergies propres : nous accompagnons les communautés vers des pratiques durables face aux défis climatiques.',
        icon: 'environment',
        visual: '',
        order: 2,
        isActive: true,
      },
      {
        title: 'Entrepreneuriat & Autonomisation',
        excerpt:
          'Formations et accompagnement pour l’autonomisation économique.',
        description:
          'Nous formons et accompagnons les jeunes entrepreneurs et les femmes dans le lancement et la croissance de leurs activités génératrices de revenus.',
        icon: 'entrepreneurship',
        visual: '',
        order: 3,
        isActive: true,
      },
      {
        title: 'Santé & Bien-être communautaire',
        excerpt: 'Actions de sensibilisation et d’accès aux soins pour tous.',
        description:
          'Campagnes de sensibilisation, dépistages et soutien aux structures sanitaires locales pour améliorer la santé et le bien-être des communautés.',
        icon: 'health',
        visual: '',
        order: 4,
        isActive: true,
      },
    ]);
    this.logger.log('✅ Programmes de démonstration créés');
  }

  private async seedPartners(): Promise<void> {
    const count = await this.partnerModel.countDocuments().exec();
    if (count > 0) {
      return;
    }
    await this.partnerModel.insertMany([
      {
        name: 'Yaba-In SARL',
        logo: '',
        website: 'https://yaba-in.com',
        description:
          'Entreprise technologique et partenaire technique.',
        order: 1,
        isActive: true,
      },
      {
        name: 'Mairie d’Abidjan',
        logo: '',
        website: 'https://abidjan.district.ci',
        description:
          'Partenariat institutionnel pour les actions communautaires.',
        order: 2,
        isActive: true,
      },
      {
        name: 'Agence de l’Environnement',
        logo: '',
        website: 'https://example.org',
        description:
          'Organisme public partenaire des programmes environnementaux.',
        order: 3,
        isActive: true,
      },
      {
        name: 'Fondation Horizon',
        logo: '',
        website: 'https://example.org',
        description: 'Partenaire financier pour les programmes éducatifs.',
        order: 4,
        isActive: true,
      },
    ]);
    this.logger.log('✅ Partenaires de démonstration créés');
  }
}
