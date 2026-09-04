import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailService } from './mail.service';
import { SmtpModule } from '../smtp/smtp.module';
import { EmailLog, EmailLogSchema } from '../email/email.schema';

@Global()
@Module({
  imports: [
    SmtpModule,
    MongooseModule.forFeature([
      { name: EmailLog.name, schema: EmailLogSchema },
    ]),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
