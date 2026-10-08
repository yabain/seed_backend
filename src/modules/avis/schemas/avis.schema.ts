import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AvisDocument = HydratedDocument<Avis>;

@Schema({
  timestamps: true,
  collection: 'avis',
})
export class Avis {
  /** Nom de la personne. */
  @Prop({ required: true, trim: true })
  name: string;

  /** Photo (URL d'upload). */
  @Prop({ default: '' })
  photo: string;

  /** Titre / poste / fonction. */
  @Prop({ default: '' })
  role: string;

  /** Texte descriptif de l'avis / témoignage. */
  @Prop({ default: '', trim: true, maxlength: 2000 })
  reviewText: string;

  /** Note sur 5 (étoiles dorées). */
  @Prop({ default: 5, min: 1, max: 5 })
  rating: number;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const AvisSchema = SchemaFactory.createForClass(Avis);