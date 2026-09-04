import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TeamDocument = HydratedDocument<Team>;

export type TeamSocialLinks = {
  facebook?: string;
  twitter?: string;
  x?: string;
  linkedin?: string;
  instagram?: string;
};

@Schema()
export class TeamSection {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  subtitle: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const TeamSectionSchema = SchemaFactory.createForClass(TeamSection);

@Schema()
export class TeamMember {
  @Prop({ default: '' })
  photo: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: {
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' },
      x: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
    },
    default: {},
  })
  socialLinks: TeamSocialLinks;

  @Prop({ type: [String], default: [] })
  sectionIds: string[];
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

@Schema({
  timestamps: true,
  collection: 'team',
})
export class Team {
  @Prop({ type: [TeamSectionSchema], default: [] })
  sections: TeamSection[];

  @Prop({ type: [TeamMemberSchema], default: [] })
  members: TeamMember[];
}

export const TeamSchema = SchemaFactory.createForClass(Team);
