import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SectionTextSchema } from './schemas/section-text.schema';
import { Identity, IdentitySchema } from './schemas/identity.schema';
import { Social, SocialSchema } from './schemas/social.schema';
import { Segments, SegmentsSchema } from './schemas/segments.schema';
import { NavVisibility, NavVisibilitySchema } from './schemas/nav-visibility.schema';
import { HoverMenu, HoverMenuSchema } from './schemas/hover-menu.schema';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';

const TEXT_SECTION_NAMES = ['events', 'news', 'programs', 'partners', 'resources', 'team', 'donations', 'recruitments', 'newsletter', 'faq'];

const textModels = TEXT_SECTION_NAMES.map((name) => {
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  const schema = SectionTextSchema.clone();
  schema.set('collection', `${name}_section`);
  return { name: `${cap}Section`, schema };
});

@Module({
  imports: [
    MongooseModule.forFeature([
      ...textModels,
      { name: Identity.name, schema: IdentitySchema, collection: 'identity_section' },
      { name: Social.name, schema: SocialSchema, collection: 'social_section' },
      { name: Segments.name, schema: SegmentsSchema, collection: 'segments_section' },
      { name: NavVisibility.name, schema: NavVisibilitySchema, collection: 'nav_visibility_section' },
      { name: HoverMenu.name, schema: HoverMenuSchema, collection: 'hover_menu_section' },
    ]),
  ],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService, MongooseModule],
})
export class SectionsModule {}