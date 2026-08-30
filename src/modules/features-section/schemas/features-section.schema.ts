import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeaturesSectionDocument = HydratedDocument<FeaturesSection>;

@Schema({ _id: false })
export class FeatureItem {
  @Prop({ default: '' })
  icon: string;

  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  details: string;
}

export const FeatureItemSchema = SchemaFactory.createForClass(FeatureItem);

const defaultFeatures = (): FeatureItem[] => [
  {
    icon: '',
    name: 'Abolition des frontières du savoir',
    details: 'Un partage d\'expériences direct entre experts internationaux et entrepreneurs locaux.',
  },
  {
    icon: '',
    name: 'Leadership serviteur & éthique',
    details: 'Placer l\'humain, l\'intégrité et l\'impact communautaire au cœur de chaque décision.',
  },
  {
    icon: '',
    name: 'Engagement durable',
    details: 'Suivi post-incubation pour assurer la pérennité et le succès de votre projet.',
  },
];

@Schema({
  timestamps: true,
  collection: 'features_section',
})
export class FeaturesSection {
  @Prop({ default: '' })
  eyebrow: string;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ type: [FeatureItemSchema], default: defaultFeatures })
  features: FeatureItem[];

  @Prop({ default: true })
  visible: boolean;
}

export const FeaturesSectionSchema = SchemaFactory.createForClass(FeaturesSection);
