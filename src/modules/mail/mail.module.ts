import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpModule } from '../smtp/smtp.module';

@Global()
@Module({
  imports: [SmtpModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
