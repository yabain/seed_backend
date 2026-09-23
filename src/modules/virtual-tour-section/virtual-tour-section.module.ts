import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VirtualTourSectionController } from './virtual-tour-section.controller';
import { VirtualTourSectionService } from './virtual-tour-section.service';
import {
  VirtualTourSection,
  VirtualTourSectionSchema,
} from './schemas/virtual-tour-section.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: VirtualTourSection.name,
        schema: VirtualTourSectionSchema,
      },
    ]),
  ],
  controllers: [VirtualTourSectionController],
  providers: [VirtualTourSectionService],
})
export class VirtualTourSectionModule {}
