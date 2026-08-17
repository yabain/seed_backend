import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SmtpController } from './smtp.controller';
import { SmtpService } from './smtp.service';
import { Smtp, SmtpSchema } from './smtp.schema';
import { CryptModule } from '../crypt/crypt.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Smtp.name, schema: SmtpSchema }]),
    CryptModule,
  ],
  controllers: [SmtpController],
  providers: [SmtpService],
  exports: [SmtpService],
})
export class SmtpModule {}
