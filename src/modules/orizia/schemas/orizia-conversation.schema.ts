import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OriziaConversationDocument = HydratedDocument<OriziaConversation>;

export interface OriziaMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  /** Identifiant du visiteur propriétaire (absent pour un utilisateur connecté). */
  visitorId?: string;
}

/**
 * Conversation Orizia (assistant IA public de l'UdM).
 *
 * Deux régimes :
 * - **Visiteur non connecté** : la conversation porte un `visitorId` — identifiant
 *   unique **contenant la date du jour**, généré par le front et conservé dans le
 *   `localStorage` du navigateur. Tant que l'identifiant est daté d'aujourd'hui,
 *   le visiteur retrouve son fil en revenant sur le site (y compris après
 *   actualisation). Un **cron quotidien à minuit** supprime toutes les
 *   conversations de visiteurs (`userId` absent).
 * - **Utilisateur connecté** : la conversation porte un `userId`, elle est
 *   conservée durablement (aucun `visitorId`, jamais purgée par le cron).
 *
 * ⚠️ Aucun index TTL n'est utilisé ici : il supprimerait la conversation au bout
 * d'un délai fixe, alors que la règle métier est « tout visiteur est purgé à
 * minuit ». La purge est donc assurée par le cron (voir `OriziaService`).
 */
@Schema({ timestamps: true, collection: 'orizia_conversations' })
export class OriziaConversation {
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, default: 'visitor' })
  role: string;

  /**
   * Identifiant unique daté du visiteur, tel que fourni par le navigateur
   * (`udm-AAAA-MM-JJ-<aléatoire>`). Sert de clé de reprise du fil.
   */
  @Prop({ required: false, index: true })
  visitorId?: string;

  /**
   * Date (AAAA-MM-JJ) extraite du `visitorId`, utilisée par le cron de purge.
   * Stockée séparément pour permettre une requête fiable même si le format de
   * l'identifiant venait à évoluer.
   */
  @Prop({ required: false, index: true })
  visitorDate?: string;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        // L'identifiant est porté par chaque message (question de l'utilisateur
        // comme réponse de l'IA), comme demandé, en plus de la conversation.
        visitorId: { type: String, required: false },
      },
    ],
    default: [],
  })
  messages: OriziaMessage[];
}

export const OriziaConversationSchema =
  SchemaFactory.createForClass(OriziaConversation);
