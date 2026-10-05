import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProspectsController,
  ProspectsPublicController,
} from './prospects.controller';
import { ProspectsService } from './prospects.service';
import { Prospect, ProspectSchema } from './prospect.schema';
import { MailModule } from '../mail/mail.module';
import { SiteModule } from '../site/site.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';

@Module({
  imports: [
    SiteModule,
    WhatsappModule,
    MongooseModule.forFeature([
      { name: Prospect.name, schema: ProspectSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    MailModule,
  ],
  controllers: [ProspectsController, ProspectsPublicController],
  providers: [ProspectsService],
  exports: [ProspectsService],
})
export class ProspectsModule {}
