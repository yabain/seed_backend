import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OriziaConversationDocument = HydratedDocument<OriziaConversation>;

export interface OriziaMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

/**
 * Conversation Orizia (assistant IA public de l'UdM).
 *
 * Deux régimes de conservation :
 * - **Visiteur non connecté** : `userId` absent → `expiresAt` est renseigné à
 *   `maintenant + ORIZIA_VISITOR_TTL_MINUTES` (60 min par défaut). L'index TTL de
 *   MongoDB supprime alors le document automatiquement : aucune conversation de
 *   visiteur ne subsiste au-delà de l'heure.
 * - **Utilisateur connecté** : `userId` renseigné → `expiresAt` reste `undefined`.
 *   Les documents dont le champ d'expiration n'est pas une date ne sont **jamais**
 *   supprimés par un index TTL : la conversation est donc conservée définitivement
 *   et rechargée à la connexion (scroll infini vers le haut).
 */
@Schema({ timestamps: true, collection: 'orizia_conversations' })
export class OriziaConversation {
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, default: 'visitor' })
  role: string;

  /** Renseigné uniquement pour les visiteurs : voir la logique de TTL ci-dessus. */
  @Prop({ type: Date, required: false, index: { expires: 0 } })
  expiresAt?: Date;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  messages: OriziaMessage[];
}

export const OriziaConversationSchema =
  SchemaFactory.createForClass(OriziaConversation);
