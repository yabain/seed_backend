import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';
import { News, NewsSchema } from '../news/schemas/news.schema';
import { Resource, ResourceSchema } from '../resources/schemas/resource.schema';
import { Program, ProgramSchema } from '../programs/schemas/program.schema';
import { Partner, PartnerSchema } from '../partners/schemas/partner.schema';
import {
  SiteConfig,
  SiteConfigSchema,
} from '../site/schemas/site-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: News.name, schema: NewsSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: SiteConfig.name, schema: SiteConfigSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
