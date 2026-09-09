import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Impact, ImpactSchema } from './schemas/impact.schema';
import { ImpactsController } from './impacts.controller';
import { ImpactsService } from './impacts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Impact.name, schema: ImpactSchema }]),
  ],
  controllers: [ImpactsController],
  providers: [ImpactsService],
  exports: [ImpactsService],
})
export class ImpactsModule {}
