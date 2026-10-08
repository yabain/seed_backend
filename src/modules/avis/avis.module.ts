import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvisController } from './avis.controller';
import { AvisService } from './avis.service';
import { Avis, AvisSchema } from './schemas/avis.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Avis.name, schema: AvisSchema }])],
  controllers: [AvisController],
  providers: [AvisService],
  exports: [AvisService],
})
export class AvisModule {}