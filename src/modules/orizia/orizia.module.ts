import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { About, AboutSchema } from '../about/schemas/about.schema';
import { DonationMethod, DonationMethodSchema } from '../donations/schemas/donation-method.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { FeaturesSection, FeaturesSectionSchema } from '../features-section/schemas/features-section.schema';
import { Impact, ImpactSchema } from '../impacts/schemas/impact.schema';
import { News, NewsSchema } from '../news/schemas/news.schema';
import { Partner, PartnerSchema } from '../partners/schemas/partner.schema';
import { Program, ProgramSchema } from '../programs/schemas/program.schema';
import { Resource, ResourceSchema } from '../resources/schemas/resource.schema';
import { SiteConfig, SiteConfigSchema } from '../site/schemas/site-config.schema';
import { Team, TeamSchema } from '../team/schemas/team.schema';
import { OriziaController } from './orizia.controller';
import { OriziaService } from './orizia.service';
import { OriziaContextBuilder } from './prompts/context.builder';
import { OriziaContextLoader } from './prompts/context-resources.loader';
import {
  OriziaConversation,
  OriziaConversationSchema,
} from './schemas/orizia-conversation.schema';

/**
 * Module de l'assistant IA « Orizia ».
 *
 * Les modèles enregistrés ici sont **exclusivement** ceux dont des données
 * publiques alimentent le contexte (voir `OriziaContextBuilder`). Aucun modèle
 * contenant des données personnelles ou confidentielles n'est importé dans ce
 * module : la garantie est donc structurelle, pas seulement déclarative.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OriziaConversation.name, schema: OriziaConversationSchema },
      { name: SiteConfig.name, schema: SiteConfigSchema },
      { name: About.name, schema: AboutSchema },
      { name: News.name, schema: NewsSchema },
      { name: Event.name, schema: EventSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: Team.name, schema: TeamSchema },
      { name: Impact.name, schema: ImpactSchema },
      { name: FeaturesSection.name, schema: FeaturesSectionSchema },
      { name: DonationMethod.name, schema: DonationMethodSchema },
    ]),
  ],
  controllers: [OriziaController],
  providers: [OriziaService, OriziaContextBuilder, OriziaContextLoader],
})
export class OriziaModule {}
