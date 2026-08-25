import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventDocument = HydratedDocument<Event>;

export type EventStatus = 'soon' | 'currently' | 'ended';

@Schema({ _id: false })
export class Panelist {
  @Prop({ default: '' })
  photo: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  title: string;
}

export const PanelistSchema = SchemaFactory.createForClass(Panelist);

@Schema({
  timestamps: true,
  collection: 'events',
})
export class Event {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ enum: ['soon', 'currently', 'ended'], default: 'soon' })
  status: EventStatus;

  @Prop({ default: '' })
  location: string;

  @Prop({ default: '' })
  program: string;

  @Prop({
    type: {
      facebook: { type: String, default: '' },
      x: { type: String, default: '' },
      youtube: { type: String, default: '' },
      linkedin: { type: String, default: '' },
    },
    default: {},
  })
  socialLinks: {
    facebook: string;
    x: string;
    youtube: string;
    linkedin: string;
  };

  @Prop({ default: '' })
  phone1: string;

  @Prop({ default: '' })
  phone2: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ type: [PanelistSchema], default: [] })
  panelists: Panelist[];

  @Prop({ default: '' })
  registrationLink: string;

  @Prop({ default: false })
  isVisibleOnLanding: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);
