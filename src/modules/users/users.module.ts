import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Admin, AdminSchema } from '../auth/schemas/admin.schema';
import { UserLog, UserLogSchema } from './schemas/user-log.schema';
import { SiteModule } from '../site/site.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    SiteModule,
    WhatsappModule,
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: UserLog.name, schema: UserLogSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
