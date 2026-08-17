import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ _id: false })
export class BannerSlide {
  @Prop({ default: '' })
  eyebrow: string;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  subtitle: string;

  @Prop({ default: '' })
  image: string;
}

export const BannerSlideSchema = SchemaFactory.createForClass(BannerSlide);

const defaultSlides = (): BannerSlide[] =>
  Array.from({ length: 3 }, () => ({
    eyebrow: '',
    title: '',
    subtitle: '',
    image: '',
  }));

@Schema({
  timestamps: true,
  collection: 'banner',
})
export class Banner {
  @Prop({ type: [BannerSlideSchema], default: defaultSlides })
  slides: BannerSlide[];
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
