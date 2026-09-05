import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DonationMethod, DonationMethodSchema } from './schemas/donation-method.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: DonationMethod.name, schema: DonationMethodSchema }])],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}