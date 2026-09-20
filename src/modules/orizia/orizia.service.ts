import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  OriziaConversation,
  OriziaConversationDocument,
} from './schemas/orizia-conversation.schema';
import { AskOriziaDto } from './dto/ask-orizia.dto';
import { OriziaContextBuilder } from './prompts/context.builder';
import { OriziaContextLoader } from './prompts/context-resources.loader';
import { ORIZIA_ROUTES_RESOURCE } from './prompts/routes.prompt';
import { ORIZIA_BASE_PROMPT } from './prompts/system.prompt';
import { searchWeb } from './tools/web-search.tool';
import { DbSearchTool } from './tools/db-search.tool';
import { SiteService } from '../site/site.service';

/** Nombre de messages précédents envoyés au modèle. */
const DEFAULT_CONTEXT_MESSAGES = 10;

/** Historique conservé en base par conversation. */
const DEFAULT_MAX_HISTORY = 50;

/** Nombre maximal de modèles OpenRouter utilisables en bascule. */
const MAX_MODELS = 5;

/** Point d'entrée par défaut : API OpenRouter compatible OpenAI. */
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Modèles utilisés par défaut, du plus souhaitable au moins souhaitable.
 *
 * Tous ont été vérifiés au catalogue OpenRouter (19/09) : variante `:free`
 * (prix d'entrée **et** de sortie à 0), contexte ≥ 262 000 jetons, et prise en
 * charge de `temperature`, `tools` (function calling) et `reasoning`.
 * Surchargeables par `ORIZIA_MODELS` dans le fichier `.env`.
 */
const DEFAULT_MODELS = [
  'nex-agi/nex-n2.5-pro:free',
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
  'deepseek/deepseek-v4-flash-0731:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

/**
 * Fuseau horaire du cron de purge.
 *
 * Lu à l'import du module : un décorateur `@Cron` ne peut pas accéder à
 * `ConfigService`. `dotenv` est chargé par `main.ts` avant les imports de
 * l'application, la variable est donc disponible.
 */
const PURGE_TIMEZONE = process.env.ORIZIA_CRON_TIMEZONE || 'Africa/Douala';

/** Message d'historique renvoyé au client. */
interface OriziaHistoryMessage {
  role: string;
  content: string;
  createdAt: Date;
}

/** Page d'historique renvoyée au client. */
export interface OriziaHistoryPageResult {
  id?: string;
  messages: OriziaHistoryMessage[];
  total: number;
}

/**
 * Réponse lorsqu'aucune conversation n'existe encore.
 *
 * Un objet explicite est préféré à `null` : NestJS enverrait alors un **corps
 * vide** en 200, que le client devrait interpréter comme une absence de données.
 */
const EMPTY_PAGE: OriziaHistoryPageResult = { messages: [], total: 0 };

/**
 * Schéma de l'outil `recherche_web`, exposé au modèle via le function calling.
 *
 * La description joue le rôle de garde-fou : le **prompt** (contexte
 * institutionnel, section 5) reste la règle d'usage effective — l'outil ne doit
 * servir que pour les questions scientifiques/éducatives dans le cadre de l'UdM
 * et pour les informations publiques.
 */
const WEB_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'recherche_web',
    description:
      "Recherche sur Internet (moteur DuckDuckGo gratuit). À utiliser UNIQUEMENT pour : (1) une question de raisonnement scientifique, académique ou de culture universitaire, posée dans le cadre de l'éducation (toutes spécialités), y compris dans le contexte de l'Université des Montagnes ; (2) retrouver une information publique (contacts, e-mails, coordonnées, horaires) absente de ton contexte. Ne t'en sers jamais hors de ce cadre, ni pour des données personnelles ou confidentielles. Passe une requête ciblée en français.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Requête de recherche ciblée, en français.',
        },
      },
      required: ['query'],
    },
  },
};

const DB_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'recherche_base',
    description:
      "Recherche dans la base de données publique de l'Université des Montagnes (actualités, programmes, ressources, événements, partenaires, équipe, page À propos, contacts officiels). À utiliser UNIQUEMENT pour retrouver une information publique institutionnelle absente de ton contexte (formations, admissions, frais, campus, contacts, événements, etc.). Ne t'en sers jamais pour des données personnelles ou confidentielles. Passe une requête ciblée en français.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Requête de recherche ciblée, en français.',
        },
      },
      required: ['query'],
    },
  },
};

/** Interface d'un appel d'outil reçu du modèle (accumulé depuis les fragments). */
interface CollectedToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Fragment d'appel d'outil reçu dans le flux SSE (accumulé par index). */
interface ToolDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** Message envoyé au modèle (le type supporte les tours d'outils). */
interface CompletionMessage {
  role: string;
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

/**
 * Erreur remontée par le fournisseur d'IA, avec un message directement
 * présentable à l'utilisateur (le détail technique reste dans les logs).
 */
class OriziaUpstreamError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
    /** Statut HTTP du fournisseur (0 lorsque l'erreur survient en cours de flux). */
    readonly status: number = 0,
  ) {
    super(message);
    this.name = 'OriziaUpstreamError';
  }
}

@Injectable()
export class OriziaService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(OriziaService.name);
  /** Routes publiques du site (constante embarquée, donc toujours disponible). */
  private readonly routesResource = ORIZIA_ROUTES_RESOURCE;

  /** Fenêtre glissante des recherches web (limitation du volume gratuit). */
  private readonly webSearchesAt: number[] = [];

  /** Curseur de rotation des modèles (stratégie `round-robin`). */
  private rotationCursor = 0;

  private runtimeOrizia = {
    enabled: true,
    openRouterApiKey: '',
    temperature: 0.7,
    reasoningLevel: 'low',
  };

  constructor(
    @InjectModel(OriziaConversation.name)
    private readonly conversationModel: Model<OriziaConversationDocument>,
    private readonly config: ConfigService,
    private readonly contextLoader: OriziaContextLoader,
    private readonly contextBuilder: OriziaContextBuilder,
    private readonly siteService: SiteService,
    private readonly dbSearchTool: DbSearchTool,
  ) {}

  onModuleInit(): void {
    // Contexte documentaire (répertoire `context_udm`) : chargé une seule fois.
    this.contextLoader.load();

    void this.refreshRuntimeOriziaConfig().then(() => {
      if (!this.apiKey) {
        this.logger.warn(
          'Clé OpenRouter absente : Orizia ne pourra pas répondre (ni en base, ni en .env).',
        );
      }
      const models = this.modelCandidates;
      this.logger.log(
        `Orizia prêt — ${models.length} modèle(s) [${models.join(' → ')}], stratégie « ${this.modelStrategy} », endpoint « ${this.baseUrl} », exécution ${this.enabled ? 'activée' : 'DÉSACTIVÉE'}`,
      );
    });
  }

  // --------------------------------------------------------------- paramètres

  private get enabled(): boolean {
    return this.runtimeOrizia.enabled;
  }

  /** Clé d'API OpenRouter (commence par `sk-or-v1-`). */
  private get apiKey(): string {
    return this.runtimeOrizia.openRouterApiKey;
  }

  /** Point d'entrée de l'API (compatible OpenAI). */
  private get baseUrl(): string {
    const raw = (this.config.get<string>('ORIZIA_BASE_URL') || DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, '');

    // L'API compatible OpenAI vit sous `/api/v1` : on accepte aussi l'URL racine
    // (`https://openrouter.ai`) par commodité — sans quoi les requêtes partiraient
    // vers `/chat/completions`, qui renvoie la **page HTML du site** avec un statut
    // 200 (échec silencieux, sans message d'erreur).
    return /^https?:\/\/openrouter\.ai$/i.test(raw) ? `${raw}/api/v1` : raw;
  }

  /**
   * En-têtes d'attribution attendus par OpenRouter (`HTTP-Referer`, `X-Title`).
   * Recommandés par ce fournisseur pour identifier l'application appelante.
   * Par défaut : l'URL publique du site et le nom de l'assistant.
   */
  private attributionHeaders(): Record<string, string> {
    return {
      // Les en-têtes HTTP ne doivent contenir que des caractères Latin-1
      // (valeurs 0-255). Node.js lève sinon « Cannot convert argument to a
      // ByteString … » et la requête échoue avant même d'être envoyée.
      'HTTP-Referer': this.toHeaderValue(
        this.config.get<string>('ORIZIA_HTTP_REFERER') || this.siteUrl,
      ),
      'X-Title': this.toHeaderValue(
        this.config.get<string>('ORIZIA_APP_TITLE') ||
          'Orizia — Université des Montagnes',
      ),
    };
  }

  /**
   * Assainit une valeur d'en-tête HTTP : tout caractère hors de la plage
   * Latin-1 (code > 255) est remplacé par un tiret ASCII, faute de quoi
   * `fetch` (undici) échoue à convertir la valeur en ByteString.
   */
  private toHeaderValue(value: string): string {
    return String(value).replace(/[^\x00-\xFF]/g, '-');
  }

  /**
   * Modèles utilisables, dans l'ordre de préférence.
   *
   * Lus depuis `ORIZIA_MODELS` (liste séparée par des virgules, **5 maximum**).
   * `ORIZIA_MODEL` (valeur unique) reste acceptée pour compatibilité. En
   * l'absence de configuration, `DEFAULT_MODELS` s'applique.
   */
  private get modelCandidates(): string[] {
    const raw =
      this.config.get<string>('ORIZIA_MODELS') ||
      this.config.get<string>('ORIZIA_MODEL') ||
      DEFAULT_MODELS.join(',');

    const models = [...new Set(raw.split(',').map((model) => model.trim()).filter(Boolean))];
    if (models.length > MAX_MODELS) {
      this.logger.warn(
        `ORIZIA_MODELS contient ${models.length} modèles : seuls les ${MAX_MODELS} premiers seront utilisés.`,
      );
    }
    return models.slice(0, MAX_MODELS);
  }

  /**
   * Stratégie de sélection des modèles : `fallback` (défaut) ou `round-robin`.
   * Voir `orderedModels()`.
   */
  private get modelStrategy(): 'fallback' | 'round-robin' {
    return (this.config.get<string>('ORIZIA_MODEL_STRATEGY') || 'fallback')
      .trim()
      .toLowerCase() === 'round-robin'
      ? 'round-robin'
      : 'fallback';
  }

  /**
   * Ordre d'essai des modèles pour la question en cours.
   *
   * - `fallback` : toujours dans l'ordre déclaré ; les suivants ne servent qu'en
   *   cas d'échec (modèle saturé, quota atteint, indisponibilité).
   * - `round-robin` : le point de départ est décalé à chaque question, ce qui
   *   répartit la charge — utile car les quotas sont appliqués **par modèle** chez
   *   la plupart des fournisseurs sous-jacents.
   */
  private orderedModels(): string[] {
    const models = this.modelCandidates;
    if (this.modelStrategy !== 'round-robin' || models.length < 2) {
      return models;
    }
    const start = this.rotationCursor++ % models.length;
    return [...models.slice(start), ...models.slice(0, start)];
  }

  private get temperature(): number {
    return this.runtimeOrizia.temperature;
  }

  private numberOf(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  /**
   * Effort de raisonnement (`low`, `medium`, `high`).
   *
   * `low` est le défaut : sur les modèles de raisonnement (gpt-oss), les jetons
   * de réflexion sont facturés comme des jetons de sortie et comptent donc dans
   * le quota. Les réduire abaisse la latence et augmente le nombre de questions
   * possibles par minute.
   *
   * Le paramètre n'est pas supporté par tous les modèles : s'il est rejeté, la
   * requête est automatiquement rejouée sans lui (voir `streamCompletion`).
   */
  private get reasoningEffort(): string {
    return this.runtimeOrizia.reasoningLevel;
  }

  private async refreshRuntimeOriziaConfig(): Promise<void> {
    const fromEnv = {
      enabled: (this.config.get<string>('ORIZIA_ENABLED') ?? 'true') !== 'false',
      openRouterApiKey: this.config.get<string>('ORIZIA_API_KEY')?.trim() ?? '',
      temperature: Number.isFinite(Number(this.config.get<string>('ORIZIA_TEMPERATURE')))
        ? Number(this.config.get<string>('ORIZIA_TEMPERATURE'))
        : 0.7,
      reasoningLevel: (this.config.get<string>('ORIZIA_REASONING_EFFORT') || 'low').trim(),
    };

    try {
      const db = await this.siteService.getOriziaRuntimeConfig();
      const temperature =
        typeof db.temperature === 'number' && Number.isFinite(db.temperature)
          ? Math.max(0, Math.min(2, Number(db.temperature.toFixed(2))))
          : fromEnv.temperature;

      const reasoning =
        db.reasoningLevel === 'low' || db.reasoningLevel === 'high'
          ? db.reasoningLevel
          : 'medium';

      this.runtimeOrizia = {
        enabled: db.enabled ?? fromEnv.enabled,
        openRouterApiKey: (db.openRouterApiKey || fromEnv.openRouterApiKey || '').trim(),
        temperature,
        reasoningLevel: reasoning,
      };
    } catch {
      this.runtimeOrizia = fromEnv;
    }
  }

  private get siteUrl(): string {
    const raw =
      this.config.get<string>('ORIZIA_SITE_URL') ||
      this.config.get<string>('SITE_URL') ||
      this.config.get<string>('CLIENT_ORIGIN') ||
      'http://localhost:4200';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  /** Active l'outil de recherche web pour Orizia (désactivable par `ORIZIA_WEB_SEARCH_ENABLED=false`). */
  private get webSearchEnabled(): boolean {
    return (
      (this.config.get<string>('ORIZIA_WEB_SEARCH_ENABLED') ?? 'true') !==
      'false'
    );
  }

  /** Nombre maximal de tours de recherche par réponse. */
  private get webMaxRounds(): number {
    return this.numberOf('ORIZIA_WEB_MAX_ROUNDS', 3);
  }

  /** Nombre maximal de résultats renvoyés au modèle pour une recherche. */
  private get webSearchMaxResults(): number {
    return this.numberOf('ORIZIA_WEB_MAX_RESULTS', 5);
  }

  /** Nombre maximal de recherches web par minute (volume gratuit, non facturé). */
  private get webSearchMaxPerMinute(): number {
    return this.numberOf('ORIZIA_WEB_MAX_PER_MINUTE', 12);
  }

  /** Autorise une nouvelle recherche si la limite de la minute n'est pas atteinte. */
  private allowWebSearch(): boolean {
    const now = Date.now();
    while (this.webSearchesAt.length && now - this.webSearchesAt[0] > 60_000) {
      this.webSearchesAt.shift();
    }
    if (this.webSearchesAt.length >= this.webSearchMaxPerMinute) {
      return false;
    }
    this.webSearchesAt.push(now);
    return true;
  }

  /** Exécute l'outil appelé par le modèle et retourne un contenu JSON lisible. */
  private async executeToolCall(call: CollectedToolCall): Promise<string> {
    if (call.name === 'recherche_web') {
      return this.executeWebSearch(call);
    }
    if (call.name === 'recherche_base') {
      return this.executeDbSearch(call);
    }
    return JSON.stringify({ error: `Outil « ${call.name} » inconnu.` });
  }

  private async executeWebSearch(call: CollectedToolCall): Promise<string> {
    let query = '';
    try {
      const parsed = JSON.parse(call.arguments || '{}') as { query?: string };
      query = typeof parsed.query === 'string' ? parsed.query.trim() : '';
    } catch {
      query = '';
    }
    if (!query) {
      return JSON.stringify({ error: 'Requête de recherche manquante.' });
    }

    if (!this.allowWebSearch()) {
      return JSON.stringify({
        note: `La limite de recherches web est atteinte (${this.webSearchMaxPerMinute}/minute). Réponds avec les sources déjà en ta possession : ne mentionne pas le moteur de recherche, ne le recontacte pas pour l'instant.`,
      });
    }

    try {
      const results = await searchWeb(query, this.webSearchMaxResults);
      if (!results.length) {
        return JSON.stringify({ error: 'Aucun résultat trouvé.', query });
      }
      return JSON.stringify({ query, results });
    } catch (error) {
      this.logger.warn(
        `Recherche web échouée (« ${query.slice(0, 60)} ») : ${(error as Error).message}`,
      );
      return JSON.stringify({
        error: `Recherche web impossible pour l'instant : ${(error as Error).message}`,
      });
    }
  }

  private async executeDbSearch(call: CollectedToolCall): Promise<string> {
    let query = '';
    try {
      const parsed = JSON.parse(call.arguments || '{}') as { query?: string };
      query = typeof parsed.query === 'string' ? parsed.query.trim() : '';
    } catch {
      query = '';
    }
    if (!query) {
      return JSON.stringify({ error: 'Requête de recherche manquante.' });
    }

    try {
      const results = await this.dbSearchTool.search(query, this.webSearchMaxResults);
      if (!results.length) {
        return JSON.stringify({ error: 'Aucun résultat trouvé dans la base.', query });
      }
      return JSON.stringify({ query, results });
    } catch (error) {
      this.logger.warn(
        `Recherche base échouée (« ${query.slice(0, 60)} ») : ${(error as Error).message}`,
      );
      return JSON.stringify({
        error: `Recherche base impossible pour l'instant : ${(error as Error).message}`,
      });
    }
  }

  /**
   * Fuseau horaire de référence pour la date du jour et le cron de purge.
   *
   * Par défaut `Africa/Douala` (Cameroun) : le « minuit » du cron et la date
   * encodée dans l'identifiant visiteur coïncident ainsi pour l'audience visée.
   */
  private get timeZone(): string {
    return (
      this.config.get<string>('ORIZIA_CRON_TIMEZONE') || 'Africa/Douala'
    ).trim();
  }

  /** Date du jour (AAAA-MM-JJ) dans le fuseau de référence. */
  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Extrait la date (AAAA-MM-JJ) encodée dans l'identifiant visiteur
   * (`udm-AAAA-MM-JJ-<aléatoire>`). Retourne `null` si l'identifiant ne suit pas
   * ce format : la conversation reste utilisable, seule la purge devient moins
   * fine (l'identifiant est alors traité comme opaque).
   */
  private visitorDateOf(visitorId: string): string | null {
    const match = /(\d{4}-\d{2}-\d{2})/.exec(visitorId);
    return match ? match[1] : null;
  }

  // ------------------------------------------------------------------ dialogue

  /**
   * Traite une question et retourne un flux de texte (streaming).
   * Accessible aux visiteurs anonymes comme aux utilisateurs connectés.
   */
  async ask(
    dto: AskOriziaDto,
    user: any,
  ): Promise<{ stream: ReadableStream<string>; conversationId: string }> {
    await this.refreshRuntimeOriziaConfig();
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Orizia est momentanément indisponible.',
      );
    }
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        "Orizia n'est pas encore configurée (clé d'API manquante côté serveur).",
      );
    }

    const userId = this.resolveUserId(user);
    // L'identifiant visiteur n'est utilisé que pour un visiteur non connecté.
    const visitorId = userId ? undefined : dto.visitorId || undefined;
    const conversation = await this.resolveConversation(
      dto.conversationId,
      userId,
      visitorId,
    );
    conversation.messages.push({
      role: 'user',
      content: dto.message,
      createdAt: new Date(),
      visitorId,
    });

    const systemContent = await this.buildSystemContent();
    const contextMessages = this.numberOf(
      'ORIZIA_CONTEXT_MESSAGES',
      DEFAULT_CONTEXT_MESSAGES,
    );
    const messages = [
      { role: 'system', content: systemContent },
      ...conversation.messages.slice(-contextMessages).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const stream = new ReadableStream<string>({
      start: async (controller) => {
        let answer = '';
        try {
          await this.streamCompletion(messages, (chunk) => {
            answer += chunk;
            controller.enqueue(chunk);
          });
        } catch (error) {
          this.logger.error(
            `Erreur de génération Orizia : ${(error as Error).message}`,
          );
          // Message précis lorsque le fournisseur expose une cause exploitable,
          // message générique sinon : aucun détail technique n'est montré au visiteur.
          const friendly =
            (error as OriziaUpstreamError)?.userMessage ||
            "Désolé, une erreur technique m'empêche de répondre pour le moment. Merci de réessayer plus tard.";
          answer = answer || friendly;
          controller.enqueue(friendly);
        }

        conversation.messages.push({
          role: 'assistant',
          content:
            answer.trim() || 'Je ne parviens pas à répondre pour le moment.',
          createdAt: new Date(),
          visitorId: conversation.visitorId,
        });
        await this.persist(conversation);
        controller.close();
      },
    });

    return { stream, conversationId: conversation._id.toString() };
  }

  /**
   * Enregistre la conversation. L'historique est plafonné (comme Merlin).
   * Aucune date d'expiration n'est posée : la purge des visiteurs est assurée
   * uniquement par le cron de minuit, afin qu'un visiteur conserve son fil toute
   * la journée.
   */
  private async persist(
    conversation: OriziaConversationDocument,
  ): Promise<void> {
    const maxHistory = this.numberOf('ORIZIA_MAX_HISTORY', DEFAULT_MAX_HISTORY);
    if (conversation.messages.length > maxHistory) {
      conversation.messages = conversation.messages.slice(-maxHistory);
    }
    try {
      await conversation.save();
    } catch (error) {
      this.logger.error(
        `Enregistrement de la conversation impossible : ${(error as Error).message}`,
      );
    }
  }

  /**
   * Retrouve la conversation à poursuivre, dans cet ordre :
   * 1. par identifiant de conversation, si l'appelant en est bien le propriétaire ;
   * 2. pour un visiteur, par son identifiant daté (reprise du fil du jour) ;
   * 3. pour un utilisateur connecté, sa dernière conversation ;
   * 4. sinon, création d'une nouvelle conversation.
   */
  private async resolveConversation(
    conversationId: string | undefined,
    userId: Types.ObjectId | undefined,
    visitorId: string | undefined,
  ): Promise<OriziaConversationDocument> {
    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      const existing = await this.conversationModel.findById(conversationId);
      if (existing && this.canContinue(existing, userId, visitorId)) {
        return existing;
      }
    }

    if (visitorId) {
      const owned = await this.conversationModel
        .findOne({ visitorId, userId: null })
        .sort({ updatedAt: -1 });
      if (owned) return owned;
    }

    if (userId) {
      const owned = await this.conversationModel
        .findOne({ userId })
        .sort({ updatedAt: -1 });
      if (owned) return owned;
    }

    return this.createConversation(conversationId, userId, visitorId);
  }

  /** L'appelant est-il bien le propriétaire de cette conversation ? */
  private canContinue(
    conversation: OriziaConversationDocument,
    userId: Types.ObjectId | undefined,
    visitorId: string | undefined,
  ): boolean {
    if (conversation.userId) {
      return !!userId && conversation.userId.toString() === userId.toString();
    }
    return !!visitorId && conversation.visitorId === visitorId;
  }

  private async createConversation(
    forcedId: string | undefined,
    userId: Types.ObjectId | undefined,
    visitorId: string | undefined,
  ): Promise<OriziaConversationDocument> {
    return this.conversationModel.create({
      ...(forcedId && Types.ObjectId.isValid(forcedId)
        ? { _id: new Types.ObjectId(forcedId) }
        : {}),
      userId,
      role: userId ? 'authenticated' : 'visitor',
      visitorId,
      // La date est dérivée de l'identifiant ; à défaut, celle du jour.
      visitorDate: visitorId
        ? (this.visitorDateOf(visitorId) ?? this.today())
        : undefined,
      messages: [],
    });
  }

  private resolveUserId(user: any): Types.ObjectId | undefined {
    const raw = user?.sub ?? user?.userId ?? user?._id ?? user?.id;
    return raw && ObjectIdValid(raw)
      ? new Types.ObjectId(String(raw))
      : undefined;
  }

  // ------------------------------------------------------------------- prompt

  /**
   * Traduit une erreur du fournisseur d'IA en message compréhensible par le
   * visiteur. Retourne une chaîne vide lorsque la cause n'est pas exploitable
   * (un message générique est alors utilisé par l'appelant).
   */
  private describeUpstreamError(status: number, detail: string): string {
    let upstream = '';
    try {
      upstream = JSON.parse(detail)?.error?.message ?? '';
    } catch {
      upstream = detail;
    }

    if (status === 429) {
      // Le fournisseur indique parfois le délai exact : « Please try again in 17s ».
      const seconds = /try again in ([\d.]+)\s*s/i.exec(upstream)?.[1];
      const wait = seconds
        ? `${Math.ceil(Number(seconds))} seconde(s)`
        : 'un instant';
      return `Le service intelligent Orizia a atteint sa limite de requêtes pour le moment. Merci de réessayer dans ${wait}.`;
    }
    if (status === 401 || status === 403) {
      return "L'accès au service d'IA est refusé : la clé d'API est invalide ou expirée.";
    }
    if (status === 404) {
      return "Le modèle d'IA configuré n'est pas disponible pour cette clé d'API.";
    }
    if (status === 413) {
      return 'La demande est trop volumineuse pour le service d’IA.';
    }
    return '';
  }

  /** Assemble le prompt système : règles + documents + données publiques + routes. */
  private async buildSystemContent(): Promise<string> {
    const institutional = this.contextLoader.get();
    const dynamic = await this.contextBuilder.build();

    const institutionalBlock = institutional
      ? institutional
      : "(aucun document de contexte n'a pu être chargé : applique uniquement les règles générales et signale tes limites à l'utilisateur)";

    const routesBlock = this.routesResource
      ? `\n--- ROUTES DU SITE ---\n${this.routesResource}\n--- FIN DES ROUTES ---`
      : '';

    const content = `${ORIZIA_BASE_PROMPT}

URL de base du site (à utiliser pour construire les liens Markdown) : ${this.siteUrl}

--- CONTEXTE INSTITUTIONNEL (identité, périmètre, confidentialité, intégrité) ---
${institutionalBlock}
--- FIN DU CONTEXTE INSTITUTIONNEL ---

--- CONTEXTE DYNAMIQUE (données publiques extraites de la base du site) ---
${dynamic}
--- FIN DU CONTEXTE DYNAMIQUE ---${routesBlock}`;

    // Diagnostic : permet de suivre la consommation de jetons face au quota du
    // fournisseur (renseigné dans le fichier .env).
    this.logger.debug(
      `Prompt système : ${content.length} caractères (~${Math.round(content.length / 3.5)} jetons) — institutionnel ${institutionalBlock.length}, dynamique ${dynamic.length}`,
    );

    return content;
  }

  /**
   * Appelle l'API de complétion (compatible OpenAI) en streaming et transmet
   * chaque fragment de texte au callback.
   *
   * Boucle d'outils : si le modèle demande `recherche_web`, le tour est exécuté
   * puis rejoué — le texte final seul est diffusé à l'utilisateur.
   *
   * On utilise `fetch` natif plutôt que le SDK `openai` : même protocole, mais
   * aucune dépendance supplémentaire à installer.
   */
  private async streamCompletion(
    messages: CompletionMessage[],
    onChunk: (text: string) => void,
  ): Promise<void> {
    const tools = this.webSearchEnabled ? [WEB_TOOL_SCHEMA, DB_TOOL_SCHEMA] : [];
    const models = this.orderedModels();
    const failures: string[] = [];

    for (let index = 0; index < models.length; index++) {
      const model = models[index];
      // Longueur de départ : permet d'annuler les tours d'outils d'un essai avorté
      // avant de confier la suite à un autre modèle.
      const checkpoint = messages.length;
      let emitted = false;
      const guardedChunk = (text: string) => {
        emitted = true;
        onChunk(text);
      };

      try {
        await this.completeWithModelFallbacks(model, messages, guardedChunk, tools);
        if (index > 0) {
          this.logger.log(
            `Orizia : réponse obtenue avec le modèle de secours « ${model} » (après ${failures.length} échec(s)).`,
          );
        }
        return;
      } catch (error) {
        messages.length = checkpoint;
        failures.push(`${model} → ${(error as Error).message.slice(0, 100)}`);

        // Du texte a déjà été diffusé : changer de modèle produirait une réponse
        // double. On remonte l'erreur (l'utilisateur conserve le texte partiel,
        // complété par le message d'erreur).
        if (emitted || index === models.length - 1 || !this.isSwitchableModelError(error)) {
          if (failures.length > 1) {
            this.logger.error(`Orizia : tous les modèles ont échoué — ${failures.join(' | ')}`);
          }
          throw error;
        }

        this.logger.warn(
          `Modèle « ${model} » indisponible (${(error as Error).message.slice(0, 100)}) : bascule vers « ${models[index + 1]} ».`,
        );
      }
    }
  }

  /**
   * Interroge un modèle donné, avec ses replis de paramètres.
   *
   * Deux replis successifs sur le **même** modèle, avant de passer au suivant :
   *   1. `reasoning_effort` refusé → nouvelle tentative sans ce paramètre ;
   *   2. function calling refusé → nouvelle tentative sans l'outil de recherche
   *      (sans `reasoning_effort` non plus : un modèle qui refuse les outils est
   *      souvent un modèle simple, qui peut également refuser ce paramètre).
   */
  private async completeWithModelFallbacks(
    model: string,
    messages: CompletionMessage[],
    onChunk: (text: string) => void,
    tools: Record<string, unknown>[],
  ): Promise<void> {
    const effort = this.reasoningEffort;
    try {
      await this.completeWithTools(model, messages, onChunk, effort, tools);
      return;
    } catch (error) {
      if (error instanceof OriziaUpstreamError && effort && /reasoning_effort/i.test(error.message)) {
        this.logger.warn(
          `Le modèle « ${model} » ne supporte pas reasoning_effort : nouvel essai sans ce paramètre.`,
        );
        await this.completeWithTools(model, messages, onChunk, '', tools);
        return;
      }
      if (
        error instanceof OriziaUpstreamError &&
        tools.length &&
        /\btool|function|invalid_request_error/i.test(error.message)
      ) {
        this.logger.warn(
          `Le modèle « ${model} » ne supporte pas le function calling : nouvelle tentative sans l'outil recherche_web.`,
        );
        await this.completeWithTools(model, messages, onChunk, '', []);
        return;
      }
      throw error;
    }
  }

  /**
   * Un échec justifie-t-il de changer de modèle ?
   *
   * **Non** pour les causes indépendantes du modèle : clé refusée (401/403),
   * requête invalide de notre côté (400/422), contenu filtré (451) — changer de
   * modèle ne corrigerait rien et masquerait la vraie cause.
   *
   * **Oui** pour tout le reste : modèle retiré ou indisponible (404), quota
   * atteint (429), erreur du fournisseur (5xx), erreur signalée en cours de flux,
   * panne réseau.
   */
  private isSwitchableModelError(error: unknown): boolean {
    if (error instanceof OriziaUpstreamError) {
      return ![400, 401, 403, 422, 451].includes(error.status);
    }
    return true;
  }

  /**
   * Réalise la complétion, en bouclant sur les appels d'outils du modèle.
   *
   * Chaque tour transmet le texte émis (`onChunk`) ; les tours dédiés aux outils
   * n'émettent normalement pas de texte. Tant que le modèle demande un appel
   * d'outil, on l'exécute et on lui renvoie le résultat, puis on rejoue.
   */
  private async completeWithTools(
    model: string,
    messages: CompletionMessage[],
    onChunk: (text: string) => void,
    effort: string,
    tools: Record<string, unknown>[],
  ): Promise<void> {
    const maxRounds = Math.max(1, this.webMaxRounds);
    for (let round = 1; round <= maxRounds; round++) {
      const toolCalls = await this.requestCompletion(
        model,
        messages,
        onChunk,
        effort,
        tools,
      );
      if (!toolCalls.length) return;

      const assistantCall: CompletionMessage = {
        role: 'assistant',
        content: '',
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      };
      messages.push(assistantCall);

      for (const call of toolCalls) {
        const output = await this.executeToolCall(call);
        messages.push({ role: 'tool', content: output, tool_call_id: call.id });
      }
    }
    this.logger.warn(
      `Orizia : ${maxRounds} tour(s) d'outil consommés pour une réponse.`,
    );
  }

  /** Un appel de complétion en streaming ; retourne les appels d'outils émis. `effort` vide = paramètre omis. */
  private async requestCompletion(
    model: string,
    messages: CompletionMessage[],
    onChunk: (text: string) => void,
    effort: string,
    tools: Record<string, unknown>[] = [],
  ): Promise<CollectedToolCall[]> {
    const abort = new AbortController();
    const timeoutMs = this.numberOf('ORIZIA_TIMEOUT_MS', 90_000);
    const timer = setTimeout(() => abort.abort(), timeoutMs);

    try {
      const payload: Record<string, unknown> = {
        model,
        messages,
        stream: true,
        temperature: this.temperature,
      };
      if (effort) {
        payload.reasoning_effort = effort;
      }
      if (tools.length) {
        payload.tools = tools;
      }
      // Facultatif : bornage de la longueur de réponse. Non défini par défaut,
      // car une valeur trop faible tronquerait les appels d'outils.
      const maxTokens = Number(this.config.get<string>('ORIZIA_MAX_TOKENS'));
      if (Number.isFinite(maxTokens) && maxTokens > 0) {
        payload.max_tokens = maxTokens;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.attributionHeaders(),
        },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        throw new OriziaUpstreamError(
          `HTTP ${response.status} ${detail.slice(0, 300)}`,
          this.describeUpstreamError(response.status, detail),
          response.status,
        );
      }

      // Garde-fou : un point d'entrée erroné (par exemple l'URL racine d'OpenRouter
      // au lieu de `/api/v1`) renvoie la page HTML du site avec un statut 200. Sans
      // ce contrôle, la réponse serait **vide sans aucune erreur** — un échec
      // silencieux particulièrement difficile à diagnostiquer.
      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      if (
        contentType &&
        !contentType.includes('text/event-stream') &&
        !contentType.includes('application/json')
      ) {
        throw new OriziaUpstreamError(
          `Réponse inattendue (${contentType}) depuis « ${this.baseUrl} » : ce point d'entrée n'est pas une API compatible OpenAI.`,
          "Le service d'IA est mal configuré (point d'entrée invalide). Merci de contacter l'administrateur du site.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const toolCallsByIndex = new Map<number, CollectedToolCall>();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: {
                delta?: { content?: string; tool_calls?: ToolDelta[] };
                finish_reason?: string | null;
              }[];
              error?: { code?: number; message?: string };
            };

            // OpenRouter signale une limite atteinte **en cours de flux** par un
            // événement SSE (`finish_reason: "error"` + objet `error`) et non par
            // un statut HTTP : sans ce contrôle, la réponse serait silencieusement
            // tronquée sans que l'utilisateur comprenne pourquoi.
            if (parsed?.error || parsed?.choices?.[0]?.finish_reason === 'error') {
              const upstream = parsed.error?.message ?? 'cause inconnue';
              const code = Number(parsed.error?.code) || 0;
              throw new OriziaUpstreamError(
                `Erreur en cours de flux : ${upstream}`,
                this.describeUpstreamError(code, JSON.stringify(parsed.error ?? {})),
                code,
              );
            }

            const delta = parsed?.choices?.[0]?.delta ?? null;
            if (!delta) continue;

            const text = delta.content;
            if (typeof text === 'string' && text) onChunk(text);

            const toolDeltas = delta.tool_calls;
            if (Array.isArray(toolDeltas)) {
              for (const rawToolDelta of toolDeltas) {
                const toolDelta = rawToolDelta as ToolDelta;
                if (!toolDelta || typeof toolDelta.index !== 'number') continue;
                const existing = toolCallsByIndex.get(toolDelta.index) ?? {
                  id: '',
                  name: '',
                  arguments: '',
                };
                if (typeof toolDelta.id === 'string' && toolDelta.id) {
                  existing.id = toolDelta.id;
                }
                if (
                  typeof toolDelta.function?.name === 'string' &&
                  toolDelta.function.name
                ) {
                  existing.name = toolDelta.function.name;
                }
                if (
                  typeof toolDelta.function?.arguments === 'string' &&
                  toolDelta.function.arguments
                ) {
                  existing.arguments += toolDelta.function.arguments;
                }
                toolCallsByIndex.set(toolDelta.index, existing);
              }
            }
          } catch (error) {
            // Une erreur de flux doit remonter : sinon elle serait avalée ici.
            if (error instanceof OriziaUpstreamError) throw error;
            // Fragment JSON incomplet : ignoré, la suite arrive au prochain lot.
          }
        }
      }

      return [...toolCallsByIndex.values()].filter(
        (call) => call.name && call.arguments,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------- historique

  /**
   * Historique d'une conversation, paginé **depuis la fin** : `skip = 0` renvoie
   * les messages les plus récents, puis on remonte progressivement (scroll
   * infini vers le haut côté interface). Réservé à son propriétaire connecté.
   */
  async getConversation(
    id: string,
    user: any,
    skip = 0,
    limit = 20,
  ): Promise<OriziaHistoryPageResult> {
    if (!ObjectIdValid(id)) return { messages: [], total: 0 };

    const conversation = await this.conversationModel.findById(id).lean();
    if (!conversation) return { messages: [], total: 0 };

    // Un visiteur (ou un autre utilisateur) n'accède pas à cet historique.
    const requester = this.resolveUserId(user);
    if (
      !conversation.userId ||
      !requester ||
      conversation.userId.toString() !== requester.toString()
    ) {
      return { messages: [], total: 0 };
    }

    return this.paginate(conversation, skip, limit);
  }

  /** Dernière conversation de l'utilisateur connecté (reprise à la connexion). */
  async getLatestConversation(
    user: any,
    skip = 0,
    limit = 20,
  ): Promise<OriziaHistoryPageResult> {
    const requester = this.resolveUserId(user);
    if (!requester) return EMPTY_PAGE;

    const conversation = await this.conversationModel
      .findOne({ userId: requester })
      .sort({ updatedAt: -1 })
      .lean();
    if (!conversation) return EMPTY_PAGE;

    return this.paginate(conversation, skip, limit);
  }

  /**
   * Reprise du fil d'un **visiteur non connecté**, à partir de son identifiant
   * daté conservé dans le `localStorage`.
   *
   * La requête est volontairement restreinte à la date encodée dans l'identifiant
   * et aux conversations **sans utilisateur rattaché** : un identifiant ne peut
   * jamais donner accès au fil d'un utilisateur connecté, ni à une journée
   * antérieure (déjà purgée). La date est dérivée de l'identifiant (comme à la
   * création de la conversation) plutôt que du `today()` du serveur : le fuseau
   * du navigateur du visiteur peut différer du fuseau de référence
   * (`ORIZIA_CRON_TIMEZONE`) de quelques heures autour de minuit.
   */
  async getVisitorConversation(
    visitorId: string,
    skip = 0,
    limit = 20,
  ): Promise<OriziaHistoryPageResult> {
    if (!visitorId?.trim()) return EMPTY_PAGE;

    const conversation = await this.conversationModel
      .findOne({
        visitorId: visitorId.trim(),
        userId: null,
        visitorDate: this.visitorDateOf(visitorId) ?? this.today(),
      })
      .sort({ updatedAt: -1 })
      .lean();
    if (!conversation) return EMPTY_PAGE;

    return this.paginate(conversation, skip, limit);
  }

  /** Pagination **depuis la fin** : `skip = 0` renvoie les messages récents. */
  private paginate(
    conversation: any,
    skip: number,
    limit: number,
  ): OriziaHistoryPageResult {
    const all = conversation.messages ?? [];
    const end = all.length - skip;
    const start = Math.max(0, end - limit);
    return {
      id: conversation._id.toString(),
      messages: all.slice(start, Math.max(0, end)),
      total: all.length,
    };
  }

  // -------------------------------------------------------------------- purge

  /**
   * Purge quotidienne des conversations de **visiteurs non connectés**, à minuit
   * (fuseau `ORIZIA_CRON_TIMEZONE`, `Africa/Douala` par défaut).
   *
   * Seules les conversations **sans utilisateur rattaché** (`userId` absent) sont
   * supprimées : celles des utilisateurs connectés sont conservées indéfiniment.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'orizia-visitor-purge',
    timeZone: PURGE_TIMEZONE,
  })
  async purgeVisitorConversations(): Promise<void> {
    try {
      const result = await this.conversationModel.deleteMany({ userId: null });
      this.logger.log(
        `Purge de minuit : ${result.deletedCount ?? 0} conversation(s) de visiteur(s) supprimée(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Purge des conversations visiteurs impossible : ${(error as Error).message}`,
      );
    }
  }

  /**
   * Filet de sécurité au démarrage : si le serveur était arrêté à minuit, la
   * purge n'a pas eu lieu. On supprime alors les conversations visiteurs des
   * jours précédents (celles du jour courant sont conservées).
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const result = await this.conversationModel.deleteMany({
        userId: null,
        $or: [{ visitorDate: { $lt: this.today() } }, { visitorDate: null }],
      });
      if (result.deletedCount) {
        this.logger.log(
          `Purge au démarrage : ${result.deletedCount} conversation(s) de visiteur(s) d'un jour précédent supprimée(s).`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Purge au démarrage ignorée : ${(error as Error).message}`,
      );
    }
  }
}

const ObjectIdValid = (value: unknown): boolean =>
  Types.ObjectId.isValid(String(value));
