import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import {
  ContactMessage,
  ContactMessageSchema,
} from './schemas/contact-message.schema';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';
import { SiteModule } from '../site/site.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    SiteModule,
    WhatsappModule,
    MongooseModule.forFeature([
      { name: ContactMessage.name, schema: ContactMessageSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
