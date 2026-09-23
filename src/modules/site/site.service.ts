import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SiteConfig,
  SiteConfigDocument,
  HoverMenu,
} from './schemas/site-config.schema';
import {
  HOVER_MENU_MAX_ITEMS,
  UpdateSiteConfigDto,
} from './dto/update-site-config.dto';
import { resolvePublicMediaUrl } from '../../utils/public-media-url.util';
import { CryptService } from '../crypt/crypt.service';

const MEDIA_KEYS: readonly string[] = ['logo', 'footerLogo', 'favicon', 'ogImage'];
const ORIZIA_MEDIA_KEYS: readonly string[] = ['logo', 'welcomeImage'];

const COLOR_KEYS: readonly string[] = ['primaryColor', 'secondaryColor'];

const SCALAR_KEYS = [
  'orgName',
  'tagline',
  'description',
  'logo',
  'footerLogo',
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
  footerLogo: '',
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
    recruitments: true,
  },
  navVisibility: {
    news: true,
    resources: true,
    programs: true,
    partners: true,
    events: true,
    team: true,
    donations: true,
    recruitments: true,
  },
  landingSections: {
    events: {
      eyebrow: 'Événements',
      title: 'Nos rendez-vous',
      description: 'Retrouvez nos événements à venir et passés.',
      buttonLabel: '',
    },
    news: {
      eyebrow: 'Actualités',
      title: 'Nos dernières nouvelles',
      description: 'Suivez notre actualité et nos réalisations.',
      buttonLabel: '',
    },
    programs: {
      eyebrow: 'Nos actions',
      title: 'Programmes et projets actifs',
      description: 'Des initiatives concrètes portées avec nos partenaires.',
      buttonLabel: '',
    },
    partners: { eyebrow: '', title: '', description: '', buttonLabel: '' },
    resources: {
      eyebrow: 'Ressources',
      title: 'Centre de ressources',
      description:
        'Téléchargez nos rapports, guides et documents institutionnels.',
      buttonLabel: '',
    },
    team: {
      eyebrow: 'Notre équipe',
      title: 'Les personnes qui nous font avancer',
      description: 'Découvrez les membres engagés au service de nos missions.',
      buttonLabel: '',
    },
    donations: {
      eyebrow: 'Faire un don',
      title: 'Contribuez à notre mission',
      description:
        'Soutenez nos projets en choisissant une méthode de paiement ci-dessous.',
      buttonLabel: 'Faire un don',
    },
    recruitments: {
      eyebrow: 'Recrutement',
      title: 'Rejoignez notre équipe',
      description:
        'Consultez les campagnes de recrutement ouvertes et proposez votre candidature.',
      buttonLabel: 'Poser une candidature',
    },
    newsletter: {
      eyebrow: 'Newsletter',
      title: 'Restez informés de nos actions',
      description: 'Inscrivez-vous pour recevoir nos actualités et nos appels à action.',
      buttonLabel: 'Nous contacter',
      backgroundImage: '',
      visible: true,
    },
    faq: {
      title: 'Questions fréquentes',
      description: 'Tout ce qu’il faut savoir avant de nous contacter.',
      buttonLabel: '',
      items: [],
      visible: true,
    },
  },
  hoverMenu: {
    enabled: false,
    title: '',
    items: [],
  },
  orizia: {
    enabled: true,
    visible: true,
    logo: '',
    welcomeImage: '',
    openRouterApiKey: '',
    temperature: 0.7,
    reasoningLevel: 'medium' as 'low' | 'medium' | 'high',
  },
};

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(SiteConfig.name)
    private readonly siteConfigModel: Model<SiteConfigDocument>,
    private readonly configService: ConfigService,
    private readonly cryptService: CryptService,
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
        Object.entries(value).map(([key, entry]) => [
          key,
          this.cloneDefault(entry),
        ]),
      ) as T;
    }
    return value;
  }

  private async getOrCreate(): Promise<SiteConfigDocument> {
    const config = await this.siteConfigModel
      .findOne()
      .sort({ createdAt: 1 })
      .exec();

    if (!config) {
      return this.siteConfigModel.create({ ...DEFAULT_CONFIG });
    }

    let changed = false;
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      const current = config.get(key);
      if (current === undefined || current === null) {
        config.set(key, this.cloneDefault(value));
        changed = true;
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Rétro-compatibilité : les configs existantes peuvent être privées de
        // clés imbriquées ajoutées ultérieurement (ex. `segments.donations`).
        // On fusionne chaque objet imbriqué avec ses valeurs par défaut pour
        // garantir que toutes les clés attendues sont présentes.
        const merged: Record<string, unknown> = {
          ...value,
          ...((current as Record<string, unknown>) ?? {}),
        };
        let nestedChanged = false;
        for (const [nestedKey, nestedDefault] of Object.entries(
          value as Record<string, unknown>,
        )) {
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
    const plain = config.toObject() as SiteConfig & {
      orizia?: { openRouterApiKey?: string };
    };
    if (plain.orizia) {
      plain.orizia.openRouterApiKey = '';
      plain.orizia.logo = this.resolveMediaUrl(plain.orizia.logo);
      plain.orizia.welcomeImage = this.resolveMediaUrl(plain.orizia.welcomeImage);
    }
    return plain;
  }

  async update(dto: UpdateSiteConfigDto): Promise<SiteConfig> {
    if (!this.hasMeaningfulPayload(dto)) {
      throw new BadRequestException(
        'Payload vide : aucune donnée à mettre à jour.',
      );
    }

    const config = await this.getOrCreate();

    // Valeurs actuelles lues AVANT toute écriture : chaque objet imbriqué fait
    // ensuite l'objet d'une fusion explicite (défauts + valeurs stockées +
    // patch). Sans cette capture préalable, l'écriture d'une section partielle
    // (ex. FAQ) écraserait les autres sections (ex. newsletter) en les faisant
    // retomber sur leurs valeurs par défaut.
    const previousSocial = (config.get('social') ?? {}) as Record<
      string,
      unknown
    >;
    const previousSegments = (config.get('segments') ?? {}) as Record<
      string,
      unknown
    >;
    const previousNavVisibility = (config.get('navVisibility') ?? {}) as Record<
      string,
      unknown
    >;
    const previousLandingSections = (config.get('landingSections') ??
      {}) as Record<string, unknown>;
    const previousHoverMenu = (config.get('hoverMenu') ??
      {}) as Partial<HoverMenu>;
    const previousOrizia = (config.get('orizia') as {
      enabled?: boolean;
      visible?: boolean;
      logo?: string;
      welcomeImage?: string;
      openRouterApiKey?: string;
      temperature?: number;
      reasoningLevel?: 'low' | 'medium' | 'high';
    }) ?? {};

    if (dto.social) {
      config.set('social', {
        ...DEFAULT_CONFIG.social,
        ...previousSocial,
        ...dto.social,
      });
    }
    if (dto.segments) {
      config.set('segments', {
        ...DEFAULT_CONFIG.segments,
        ...previousSegments,
        ...dto.segments,
      });
    }
    if (dto.navVisibility) {
      config.set('navVisibility', {
        ...DEFAULT_CONFIG.navVisibility,
        ...previousNavVisibility,
        ...dto.navVisibility,
      });
    }
    if (dto.landingSections) {
      config.set('landingSections', {
        ...DEFAULT_CONFIG.landingSections,
        ...previousLandingSections,
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
    if (dto.orizia) {
      const nextTemperature =
        typeof dto.orizia.temperature === 'number' &&
        Number.isFinite(dto.orizia.temperature)
          ? Math.max(0, Math.min(2, Number(dto.orizia.temperature.toFixed(2))))
          : (previousOrizia.temperature ?? DEFAULT_CONFIG.orizia.temperature);

      const nextReasoning = (dto.orizia.reasoningLevel ?? previousOrizia.reasoningLevel ?? 'medium')
        .toString()
        .trim()
        .toLowerCase() as 'low' | 'medium' | 'high';

      const normalizedReasoning: 'low' | 'medium' | 'high' =
        nextReasoning === 'low' || nextReasoning === 'high'
          ? nextReasoning
          : 'medium';

      let encryptedApiKey = previousOrizia.openRouterApiKey ?? '';
      if (dto.orizia.openRouterApiKey !== undefined) {
        const rawKey = String(dto.orizia.openRouterApiKey ?? '').trim();
        encryptedApiKey = rawKey
          ? this.cryptService.encrypt(rawKey)
          : '';
      }

      config.set('orizia', {
        enabled: dto.orizia.enabled ?? previousOrizia.enabled ?? true,
        visible: dto.orizia.visible ?? previousOrizia.visible ?? true,
        logo: (dto.orizia.logo ?? previousOrizia.logo ?? '').trim(),
        welcomeImage: (dto.orizia.welcomeImage ?? previousOrizia.welcomeImage ?? '').trim(),
        openRouterApiKey: encryptedApiKey,
        temperature: nextTemperature,
        reasoningLevel: normalizedReasoning,
      });
    }

    // Champs scalaires appliqués en dernier : ils ne touchent à aucun objet
    // imbriqué, donc rien n'est écrasé par accident.
    config.set(this.scalarPatch(dto));
    await config.save();
    const plain = config.toObject() as SiteConfig & {
      orizia?: { openRouterApiKey?: string };
    };
    if (plain.orizia) {
      plain.orizia.openRouterApiKey = '';
      plain.orizia.logo = this.resolveMediaUrl(plain.orizia.logo);
      plain.orizia.welcomeImage = this.resolveMediaUrl(plain.orizia.welcomeImage);
    }
    return plain;
  }

  async getOriziaSettingsForAdmin(): Promise<{
    enabled: boolean;
    visible: boolean;
    logo: string;
    welcomeImage: string;
    openRouterApiKey: string;
    temperature: number;
    reasoningLevel: 'low' | 'medium' | 'high';
  }> {
    const config = await this.getOrCreate();
    const orizia =
      (config.get('orizia') as {
        enabled?: boolean;
        visible?: boolean;
        logo?: string;
        welcomeImage?: string;
        openRouterApiKey?: string;
        temperature?: number;
        reasoningLevel?: 'low' | 'medium' | 'high';
      }) ?? {};

    let apiKey = '';
    if (orizia.openRouterApiKey) {
      try {
        apiKey = this.cryptService.decrypt(orizia.openRouterApiKey);
      } catch {
        apiKey = '';
      }
    }

    return {
      enabled: orizia.enabled ?? true,
      visible: orizia.visible ?? true,
      logo: this.resolveMediaUrl(orizia.logo),
      welcomeImage: this.resolveMediaUrl(orizia.welcomeImage),
      openRouterApiKey: apiKey,
      temperature:
        typeof orizia.temperature === 'number' && Number.isFinite(orizia.temperature)
          ? Math.max(0, Math.min(2, Number(orizia.temperature.toFixed(2))))
          : 0.7,
      reasoningLevel:
        orizia.reasoningLevel === 'low' || orizia.reasoningLevel === 'high'
          ? orizia.reasoningLevel
          : 'medium',
    };
  }

  async updateOriziaSettings(payload: {
    enabled?: boolean;
    visible?: boolean;
    logo?: string;
    welcomeImage?: string;
    openRouterApiKey?: string;
    temperature?: number;
    reasoningLevel?: 'low' | 'medium' | 'high';
  }): Promise<{
    enabled: boolean;
    visible: boolean;
    logo: string;
    welcomeImage: string;
    openRouterApiKey: string;
    temperature: number;
    reasoningLevel: 'low' | 'medium' | 'high';
  }> {
    const config = await this.getOrCreate();
    const current =
      (config.get('orizia') as {
        enabled?: boolean;
        visible?: boolean;
        logo?: string;
        welcomeImage?: string;
        openRouterApiKey?: string;
        temperature?: number;
        reasoningLevel?: 'low' | 'medium' | 'high';
      }) ?? {};

    const nextTemperature =
      typeof payload.temperature === 'number' && Number.isFinite(payload.temperature)
        ? Math.max(0, Math.min(2, Number(payload.temperature.toFixed(2))))
        : (current.temperature ?? 0.7);

    const nextReasoningRaw = (payload.reasoningLevel ?? current.reasoningLevel ?? 'medium')
      .toString()
      .trim()
      .toLowerCase();
    const nextReasoning: 'low' | 'medium' | 'high' =
      nextReasoningRaw === 'low' || nextReasoningRaw === 'high'
        ? (nextReasoningRaw as 'low' | 'high')
        : 'medium';

    let encryptedKey = current.openRouterApiKey ?? '';
    if (payload.openRouterApiKey !== undefined) {
      const raw = String(payload.openRouterApiKey ?? '').trim();
      encryptedKey = raw ? this.cryptService.encrypt(raw) : '';
    }

    config.set('orizia', {
      enabled: payload.enabled ?? current.enabled ?? true,
      visible: payload.visible ?? current.visible ?? true,
      logo: (payload.logo ?? current.logo ?? '').trim(),
      welcomeImage: (payload.welcomeImage ?? current.welcomeImage ?? '').trim(),
      openRouterApiKey: encryptedKey,
      temperature: nextTemperature,
      reasoningLevel: nextReasoning,
    });

    await config.save();
    return this.getOriziaSettingsForAdmin();
  }

  async getOriziaRuntimeConfig(): Promise<{
    enabled: boolean;
    visible: boolean;
    logo: string;
    welcomeImage: string;
    openRouterApiKey: string;
    temperature: number;
    reasoningLevel: 'low' | 'medium' | 'high';
  }> {
    const config = await this.getOrCreate();
    const orizia =
      (config.get('orizia') as {
        enabled?: boolean;
        visible?: boolean;
        logo?: string;
        welcomeImage?: string;
        openRouterApiKey?: string;
        temperature?: number;
        reasoningLevel?: 'low' | 'medium' | 'high';
      }) ?? {};

    let apiKey = '';
    if (orizia.openRouterApiKey) {
      try {
        apiKey = this.cryptService.decrypt(orizia.openRouterApiKey);
      } catch {
        apiKey = '';
      }
    }

    return {
      enabled: orizia.enabled ?? true,
      visible: orizia.visible ?? true,
      logo: this.resolveMediaUrl(orizia.logo),
      welcomeImage: this.resolveMediaUrl(orizia.welcomeImage),
      openRouterApiKey: apiKey,
      temperature:
        typeof orizia.temperature === 'number' && Number.isFinite(orizia.temperature)
          ? Math.max(0, Math.min(2, Number(orizia.temperature.toFixed(2))))
          : 0.7,
      reasoningLevel:
        orizia.reasoningLevel === 'low' || orizia.reasoningLevel === 'high'
          ? orizia.reasoningLevel
          : 'medium',
    };
  }

  private hasMeaningfulPayload(dto: UpdateSiteConfigDto): boolean {
    const entries = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    );
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
    if (
      dto.segments &&
      Object.values(dto.segments).some((value) => typeof value === 'boolean')
    ) {
      return true;
    }
    if (
      dto.navVisibility &&
      Object.values(dto.navVisibility).some((value) => typeof value === 'boolean')
    ) {
      return true;
    }
    if (
      dto.landingSections &&
      Object.values(dto.landingSections).some(
        (section) =>
          section &&
          Object.values(section).some(
            (value) =>
              typeof value === 'string' ||
              (Array.isArray(value) && value.length > 0),
          ),
      )
    ) {
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
    if (dto.orizia) {
      if (
        typeof dto.orizia.enabled === 'boolean' ||
        typeof dto.orizia.visible === 'boolean' ||
        typeof dto.orizia.temperature === 'number' ||
        typeof dto.orizia.reasoningLevel === 'string'
      ) {
        return true;
      }
      if (
        ORIZIA_MEDIA_KEYS.some((key) => {
          const value = (dto.orizia as Record<string, unknown>)[key];
          return typeof value === 'string';
        })
      ) {
        return true;
      }
      if (typeof dto.orizia.openRouterApiKey === 'string') {
        return true;
      }
    }
    return false;
  }

  private scalarPatch(dto: UpdateSiteConfigDto): Record<string, unknown> {
    const nestedKeys = new Set([
      'social',
      'segments',
      'navVisibility',
      'landingSections',
      'hoverMenu',
      'orizia',
    ]);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && !nestedKeys.has(key)) {
        patch[key] = value;
      }
    }
    return patch;
  }
}
