import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteConfig, SiteConfigDocument, HoverMenu } from './schemas/site-config.schema';
import { HOVER_MENU_MAX_ITEMS, UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { resolvePublicMediaUrl } from '../../utils/public-media-url.util';

const MEDIA_KEYS: readonly string[] = ['logo', 'favicon', 'ogImage'];

const COLOR_KEYS: readonly string[] = ['primaryColor', 'secondaryColor'];

const SCALAR_KEYS = [
  'orgName',
  'tagline',
  'description',
  'logo',
  'favicon',
  'ogImage',
  'heroTitle',
  'heroSubtitle',
  'address',
  'phone',
  'phone2',
  'email',
  'primaryColor',
  'secondaryColor',
] as const;

const DEFAULT_CONFIG = {
  orgName: 'Organisation',
  tagline: '',
  description: '',
  logo: '',
  favicon: '',
  ogImage: '',
  heroTitle: '',
  heroSubtitle: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  primaryColor: '',
  secondaryColor: '',
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    youtube: '',
  },
  segments: {
    news: true,
    resources: true,
    programs: true,
    partners: true,
    events: true,
    team: true,
    donations: true,
  },
  landingSections: {
    events: { eyebrow: 'Événements', title: 'Nos rendez-vous', description: 'Retrouvez nos événements à venir et passés.', buttonLabel: '' },
    news: { eyebrow: 'Actualités', title: 'Nos dernières nouvelles', description: 'Suivez notre actualité et nos réalisations.', buttonLabel: '' },
    programs: { eyebrow: 'Nos actions', title: 'Programmes et projets actifs', description: 'Des initiatives concrètes portées avec nos partenaires.', buttonLabel: '' },
    partners: { eyebrow: '', title: '', description: '', buttonLabel: '' },
    resources: { eyebrow: 'Ressources', title: 'Centre de ressources', description: 'Téléchargez nos rapports, guides et documents institutionnels.', buttonLabel: '' },
    team: { eyebrow: 'Notre équipe', title: 'Les personnes qui nous font avancer', description: 'Découvrez les membres engagés au service de nos missions.', buttonLabel: '' },
    donations: { eyebrow: 'Faire un don', title: 'Contribuez à notre mission', description: 'Soutenez nos projets en choisissant une méthode de paiement ci-dessous.', buttonLabel: 'Faire un don' },
  },
  hoverMenu: {
    enabled: false,
    title: '',
    items: [],
  },
};

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(SiteConfig.name)
    private readonly siteConfigModel: Model<SiteConfigDocument>,
    private readonly configService: ConfigService,
  ) {}

  resolveMediaUrl(url?: string): string {
    const base =
      this.configService.get<string>('PUBLIC_URL') ?? 'http://localhost:3000';
    return resolvePublicMediaUrl(url, base);
  }

  /**
   * Copie profonde d'une valeur par défaut. Les tableaux sont recopiés
   * explicitement : `{ ...tableau }` produirait un objet et non un tableau, ce
   * qui corromprait les valeurs par défaut de type liste (ex. `hoverMenu.items`).
   */
  private cloneDefault<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((entry) => this.cloneDefault(entry)) as unknown as T;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.cloneDefault(entry)]),
      ) as T;
    }
    return value;
  }

  private async getOrCreate(): Promise<SiteConfigDocument> {
    let config = await this.siteConfigModel.findOne().sort({ createdAt: 1 }).exec();

    if (!config) {
      return this.siteConfigModel.create({ ...DEFAULT_CONFIG });
    }

    let changed = false;
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      const current = config.get(key);
      if (current === undefined || current === null) {
        config.set(key, this.cloneDefault(value));
        changed = true;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Rétro-compatibilité : les configs existantes peuvent être privées de
        // clés imbriquées ajoutées ultérieurement (ex. `segments.donations`).
        // On fusionne chaque objet imbriqué avec ses valeurs par défaut pour
        // garantir que toutes les clés attendues sont présentes.
        const merged: Record<string, unknown> = {
          ...value,
          ...((current as Record<string, unknown>) ?? {}),
        };
        let nestedChanged = false;
        for (const [nestedKey, nestedDefault] of Object.entries(value as Record<string, unknown>)) {
          if (merged[nestedKey] === undefined || merged[nestedKey] === null) {
            merged[nestedKey] = this.cloneDefault(nestedDefault);
            nestedChanged = true;
          }
        }
        if (nestedChanged) {
          config.set(key, merged);
          changed = true;
        }
      }
    }
    if (changed) {
      await config.save();
    }
    return config;
  }

  async getPublicConfig(): Promise<SiteConfig> {
    const config = await this.getOrCreate();
    return config.toObject();
  }

  async update(dto: UpdateSiteConfigDto): Promise<SiteConfig> {
    if (!this.hasMeaningfulPayload(dto)) {
      throw new BadRequestException(
        'Payload vide : aucune donnée à mettre à jour.',
      );
    }

    const config = await this.getOrCreate();

    // Valeurs actuelles lues AVANT `compact(dto)` : `config.set` remplace
    // l'objet imbriqué et réinitialise à leur valeur par défaut les clés
    // absentes. Sans cela, une mise à jour partielle du menu (ex. simple bascule
    // de visibilité) écraserait le titre et les sous-menus déjà enregistrés.
    const previousHoverMenu = (config.get('hoverMenu') ?? {}) as Partial<HoverMenu>;

    config.set(this.compact(dto));
    if (dto.social) {
      config.set('social', {
        ...DEFAULT_CONFIG.social,
        ...(config.social ?? {}),
        ...dto.social,
      });
    }
    if (dto.segments) {
      config.set('segments', {
        ...DEFAULT_CONFIG.segments,
        ...(config.segments ?? {}),
        ...dto.segments,
      });
    }
    if (dto.landingSections) {
      config.set('landingSections', {
        ...DEFAULT_CONFIG.landingSections,
        ...(config.landingSections ?? {}),
        ...dto.landingSections,
      });
    }
    if (dto.hoverMenu) {
      // Le menu est remplacé en bloc (et non fusionné entrée par entrée) : la
      // suppression d'un sous-menu doit être persistée. Les clés non transmises
      // reprennent leur valeur précédente. La limite de 4 entrées est également
      // appliquée ici, en filet de sécurité du DTO.
      const items = (dto.hoverMenu.items ?? previousHoverMenu.items ?? [])
        .slice(0, HOVER_MENU_MAX_ITEMS)
        .map((item) => ({
          title: item.title ?? '',
          description: item.description ?? '',
          link: (item.link ?? '').trim(),
        }));
      config.set('hoverMenu', {
        enabled: dto.hoverMenu.enabled ?? previousHoverMenu.enabled ?? false,
        title: dto.hoverMenu.title ?? previousHoverMenu.title ?? '',
        items,
      });
    }
    await config.save();
    return config.toObject();
  }

  private hasMeaningfulPayload(dto: UpdateSiteConfigDto): boolean {
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    const isReset =
      entries.length > 0 &&
      entries.every(
        ([key, value]) =>
          (MEDIA_KEYS.includes(key) || COLOR_KEYS.includes(key)) &&
          typeof value === 'string' &&
          value.trim() === '',
      );
    if (isReset) {
      return true;
    }

    const hasScalar = SCALAR_KEYS.some((key) => {
      const value = dto[key];
      return typeof value === 'string' && value.trim().length > 0;
    });
    if (hasScalar) {
      return true;
    }
    if (
      dto.social &&
      Object.values(dto.social).some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      )
    ) {
      return true;
    }
    if (dto.segments && Object.values(dto.segments).some((value) => typeof value === 'boolean')) {
      return true;
    }
    if (dto.landingSections && Object.values(dto.landingSections).some((section) =>
      section && Object.values(section).some((value) => typeof value === 'string'),
    )) {
      return true;
    }
    if (
      dto.hoverMenu &&
      (typeof dto.hoverMenu.enabled === 'boolean' ||
        (dto.hoverMenu.title ?? '').trim().length > 0 ||
        (dto.hoverMenu.items?.length ?? 0) > 0)
    ) {
      return true;
    }
    return false;
  }

  private compact(dto: UpdateSiteConfigDto): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    return patch;
  }
}
