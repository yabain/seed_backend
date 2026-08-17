import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { SiteConfig, SiteConfigSchema } from './schemas/site-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiteConfig.name, schema: SiteConfigSchema },
    ]),
  ],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
