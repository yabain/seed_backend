import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeaturesSection, FeaturesSectionSchema } from './schemas/features-section.schema';
import { FeaturesSectionService } from './features-section.service';
import { FeaturesSectionController } from './features-section.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeaturesSection.name, schema: FeaturesSectionSchema },
    ]),
  ],
  controllers: [FeaturesSectionController],
  providers: [FeaturesSectionService],
  exports: [FeaturesSectionService],
})
export class FeaturesSectionModule {}