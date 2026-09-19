import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OriziaConversation, OriziaConversationDocument } from './schemas/orizia-conversation.schema';
import { AskOriziaDto } from './dto/ask-orizia.dto';
import { OriziaContextBuilder } from './prompts/context.builder';
import { OriziaContextLoader } from './prompts/context-resources.loader';
import { ORIZIA_ROUTES_RESOURCE } from './prompts/routes.prompt';
import { ORIZIA_BASE_PROMPT } from './prompts/system.prompt';

/** Messages envoyés au modèle (les plus récents) — identique à Merlin. */
const DEFAULT_CONTEXT_MESSAGES = 10;

/** Historique conservé en base par conversation — identique à Merlin. */
const DEFAULT_MAX_HISTORY = 50;

@Injectable()
export class OriziaService implements OnModuleInit {
  private readonly logger = new Logger(OriziaService.name);
  /** Routes publiques du site (constante embarquée, donc toujours disponible). */
  private readonly routesResource = ORIZIA_ROUTES_RESOURCE;

  constructor(
    @InjectModel(OriziaConversation.name)
    private readonly conversationModel: Model<OriziaConversationDocument>,
    private readonly config: ConfigService,
    private readonly contextLoader: OriziaContextLoader,
    private readonly contextBuilder: OriziaContextBuilder,
  ) {}

  onModuleInit(): void {
    // Contexte documentaire (répertoire `context_udm`) : chargé une seule fois.
    this.contextLoader.load();

    if (!this.apiKey) {
      this.logger.warn(
        'ORIZIA_API_KEY (ou GROQ_API_KEY) est absente : Orizia ne pourra pas répondre. Renseignez la clé dans le fichier .env.',
      );
    }
    this.logger.log(
      `Orizia prêt — modèle « ${this.modelName} », endpoint « ${this.baseUrl} », exécution ${this.enabled ? 'activée' : 'DÉSACTIVÉE'}`,
    );
  }

  // --------------------------------------------------------------- paramètres

  private get enabled(): boolean {
    return (this.config.get<string>('ORIZIA_ENABLED') ?? 'true') !== 'false';
  }

  private get apiKey(): string {
    return (
      this.config.get<string>('ORIZIA_API_KEY') ||
      this.config.get<string>('GROQ_API_KEY') ||
      ''
    );
  }

  private get baseUrl(): string {
    return (
      this.config.get<string>('ORIZIA_BASE_URL') || 'https://api.groq.com/openai/v1'
    ).replace(/\/$/, '');
  }

  /**
   * Modèle par défaut : `llama-3.3-70b-versatile`. Merlin utilisait
   * `gemma2-9b-it`, retiré du catalogue Groq — le défaut a donc été mis à jour
   * tout en restant surchargeable par `ORIZIA_MODEL`.
   */
  private get modelName(): string {
    return this.config.get<string>('ORIZIA_MODEL') || 'llama-3.3-70b-versatile';
  }

  private get temperature(): number {
    const value = Number(this.config.get<string>('ORIZIA_TEMPERATURE'));
    return Number.isFinite(value) ? value : 0.7;
  }

  private numberOf(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private get siteUrl(): string {
    const raw =
      this.config.get<string>('ORIZIA_SITE_URL') ||
      this.config.get<string>('SITE_URL') ||
      this.config.get<string>('CLIENT_ORIGIN') ||
      'http://localhost:4200';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  private get visitorTtlMinutes(): number {
    return this.numberOf('ORIZIA_VISITOR_TTL_MINUTES', 60);
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
    if (!this.enabled) {
      throw new ServiceUnavailableException("Orizia est momentanément indisponible.");
    }
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        "Orizia n'est pas encore configurée (clé d'API manquante côté serveur).",
      );
    }

    const userId = this.resolveUserId(user);
    const conversation = await this.resolveConversation(dto.conversationId, userId);
    conversation.messages.push({ role: 'user', content: dto.message, createdAt: new Date() });

    const systemContent = await this.buildSystemContent();
    const contextMessages = this.numberOf('ORIZIA_CONTEXT_MESSAGES', DEFAULT_CONTEXT_MESSAGES);
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
          this.logger.error(`Erreur de génération Orizia : ${(error as Error).message}`);
          const fallback = /429|quota|rate/i.test((error as Error).message)
            ? 'Le service est momentanément surchargé. Merci de réessayer dans quelques minutes.'
            : "Désolé, une erreur technique m'empêche de répondre pour le moment. Merci de réessayer plus tard.";
          answer = answer || fallback;
          controller.enqueue(fallback);
        }

        conversation.messages.push({
          role: 'assistant',
          content: answer.trim() || 'Je ne parviens pas à répondre pour le moment.',
          createdAt: new Date(),
        });
        await this.persist(conversation);
        controller.close();
      },
    });

    return { stream, conversationId: conversation._id.toString() };
  }

  /**
   * Enregistre la conversation. L'historique est plafonné (comme Merlin) et,
   * pour un visiteur, la date d'expiration est repoussée à chaque échange : le
   * délai d'une heure court donc à partir de la dernière activité.
   */
  private async persist(conversation: OriziaConversationDocument): Promise<void> {
    const maxHistory = this.numberOf('ORIZIA_MAX_HISTORY', DEFAULT_MAX_HISTORY);
    if (conversation.messages.length > maxHistory) {
      conversation.messages = conversation.messages.slice(-maxHistory);
    }
    if (!conversation.userId) {
      conversation.expiresAt = new Date(Date.now() + this.visitorTtlMinutes * 60_000);
    }
    try {
      await conversation.save();
    } catch (error) {
      this.logger.error(`Enregistrement de la conversation impossible : ${(error as Error).message}`);
    }
  }

  private async resolveConversation(
    conversationId: string | undefined,
    userId: Types.ObjectId | undefined,
  ): Promise<OriziaConversationDocument> {
    const role = userId ? 'authenticated' : 'visitor';

    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      const existing = await this.conversationModel.findById(conversationId);
      if (existing) {
        const owner = existing.userId?.toString();
        // Un visiteur ne peut ni lire ni poursuivre la conversation d'un
        // utilisateur connecté : on repart sur une conversation neuve.
        if (!existing.userId || (userId && owner === userId.toString())) {
          return existing;
        }
      } else {
        return this.createConversation(conversationId, userId, role);
      }
    }
    return this.createConversation(undefined, userId, role);
  }

  private async createConversation(
    forcedId: string | undefined,
    userId: Types.ObjectId | undefined,
    role: string,
  ): Promise<OriziaConversationDocument> {
    const expiresAt = userId ? undefined : new Date(Date.now() + this.visitorTtlMinutes * 60_000);
    return this.conversationModel.create({
      ...(forcedId ? { _id: new Types.ObjectId(forcedId) } : {}),
      userId,
      role,
      expiresAt,
      messages: [],
    });
  }

  private resolveUserId(user: any): Types.ObjectId | undefined {
    const raw = user?.sub ?? user?.userId ?? user?._id ?? user?.id;
    return raw && ObjectIdValid(raw) ? new Types.ObjectId(String(raw)) : undefined;
  }

  // ------------------------------------------------------------------- prompt

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

    return `${ORIZIA_BASE_PROMPT}

URL de base du site (à utiliser pour construire les liens Markdown) : ${this.siteUrl}

--- CONTEXTE INSTITUTIONNEL (identité, périmètre, confidentialité, intégrité) ---
${institutionalBlock}
--- FIN DU CONTEXTE INSTITUTIONNEL ---

--- CONTEXTE DYNAMIQUE (données publiques extraites de la base du site) ---
${dynamic}
--- FIN DU CONTEXTE DYNAMIQUE ---${routesBlock}`;
  }

  /**
   * Appelle l'API de complétion (compatible OpenAI) en streaming et transmet
   * chaque fragment de texte au callback.
   *
   * On utilise `fetch` natif plutôt que le SDK `openai` : même protocole, mais
   * aucune dépendance supplémentaire à installer.
   */
  private async streamCompletion(
    messages: { role: string; content: string }[],
    onChunk: (text: string) => void,
  ): Promise<void> {
    const abort = new AbortController();
    const timeoutMs = this.numberOf('ORIZIA_TIMEOUT_MS', 90_000);
    const timer = setTimeout(() => abort.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          stream: true,
          temperature: this.temperature,
        }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${detail.slice(0, 300)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            const parsed = JSON.parse(payload);
            const text = parsed?.choices?.[0]?.delta?.content;
            if (typeof text === 'string' && text) onChunk(text);
          } catch {
            // Fragment JSON incomplet : ignoré, la suite arrive au prochain lot.
          }
        }
      }
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
  ): Promise<{ messages: { role: string; content: string; createdAt: Date }[]; total: number }> {
    if (!ObjectIdValid(id)) return { messages: [], total: 0 };

    const conversation = await this.conversationModel.findById(id).lean();
    if (!conversation) return { messages: [], total: 0 };

    // Un visiteur (ou un autre utilisateur) n'accède pas à cet historique.
    const requester = this.resolveUserId(user);
    if (!conversation.userId || !requester || conversation.userId.toString() !== requester.toString()) {
      return { messages: [], total: 0 };
    }

    const all = conversation.messages ?? [];
    const end = all.length - skip;
    const start = Math.max(0, end - limit);
    return { messages: all.slice(start, Math.max(0, end)), total: all.length };
  }

  /** Dernière conversation de l'utilisateur connecté (reprise à la connexion). */
  async getLatestConversation(
    user: any,
    skip = 0,
    limit = 20,
  ): Promise<{ id: string; messages: { role: string; content: string; createdAt: Date }[]; total: number } | null> {
    const requester = this.resolveUserId(user);
    if (!requester) return null;

    const conversation = await this.conversationModel
      .findOne({ userId: requester })
      .sort({ updatedAt: -1 })
      .lean();
    if (!conversation) return null;

    const all = conversation.messages ?? [];
    const end = all.length - skip;
    const start = Math.max(0, end - limit);
    return {
      id: conversation._id.toString(),
      messages: all.slice(start, Math.max(0, end)),
      total: all.length,
    };
  }
}

const ObjectIdValid = (value: unknown): boolean => Types.ObjectId.isValid(String(value));


