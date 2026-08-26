import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CountriesSection, CountriesSectionSchema } from './schemas/countries-section.schema';
import { CountriesSectionService } from './countries-section.service';
import { CountriesSectionController } from './countries-section.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CountriesSection.name, schema: CountriesSectionSchema },
    ]),
  ],
  controllers: [CountriesSectionController],
  providers: [CountriesSectionService],
  exports: [CountriesSectionService],
})
export class CountriesSectionModule {}