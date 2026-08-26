import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CountriesSectionDocument = HydratedDocument<CountriesSection>;

@Schema({ _id: false })
export class CountryItem {
  @Prop({ default: '' })
  image: string;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  subtitle: string;
}

export const CountryItemSchema = SchemaFactory.createForClass(CountryItem);

const defaultCountries = (): CountryItem[] => [
  {
    image: '/assets/flags/cameroon.avif',
    title: 'Cameroon',
    subtitle: '',
  },
  {
    image: '/assets/flags/benin.avif',
    title: 'Benin',
    subtitle: '',
  },
  {
    image: '/assets/flags/gabon.avif',
    title: 'Gabon',
    subtitle: '',
  },
  {
    image: '/assets/flags/togo.avif',
    title: 'Togo',
    subtitle: '',
  },
];

@Schema({
  timestamps: true,
  collection: 'countries_section',
})
export class CountriesSection {
  @Prop({ default: '4 Countries' })
  title: string;

  @Prop({ default: '' })
  backgroundImage: string;

  @Prop({ type: [CountryItemSchema], default: defaultCountries })
  countries: CountryItem[];

  @Prop({ default: true })
  visible: boolean;
}

export const CountriesSectionSchema = SchemaFactory.createForClass(CountriesSection);