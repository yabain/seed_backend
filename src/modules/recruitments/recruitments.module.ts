import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RecruitmentCampaign,
  RecruitmentCampaignSchema,
} from './schemas/recruitment-campaign.schema';
import {
  RecruitmentApplication,
  RecruitmentApplicationSchema,
} from './schemas/recruitment-application.schema';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';
import { RecruitmentsController } from './recruitments.controller';
import { RecruitmentsService } from './recruitments.service';
import { MailModule } from '../mail/mail.module';
import { SiteModule } from '../site/site.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecruitmentCampaign.name, schema: RecruitmentCampaignSchema },
      {
        name: RecruitmentApplication.name,
        schema: RecruitmentApplicationSchema,
      },
      { name: Admin.name, schema: AdminSchema },
    ]),
    MailModule,
    SiteModule,
    WhatsappModule,
  ],
  controllers: [RecruitmentsController],
  providers: [RecruitmentsService],
  exports: [RecruitmentsService],
})
export class RecruitmentsModule {}
