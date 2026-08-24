import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';
import {
  AnnouncementSettings,
  AnnouncementSettingsSchema,
} from './schemas/announcement-settings.schema';
import {
  DistributedLock,
  DistributedLockSchema,
} from './schemas/distributed-lock.schema';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';
import { Prospect, ProspectSchema } from '../prospects/prospect.schema';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsCronService } from './announcements-cron.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: AnnouncementSettings.name, schema: AnnouncementSettingsSchema },
      { name: DistributedLock.name, schema: DistributedLockSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Prospect.name, schema: ProspectSchema },
    ]),
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementsCronService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
