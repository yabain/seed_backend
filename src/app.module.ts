import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { NewsModule } from './modules/news/news.module';
import { NewsCategoryModule } from './modules/news-category/news-category.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { PartnersModule } from './modules/partners/partners.module';
import { ContactModule } from './modules/contact/contact.module';
import { ProspectsModule } from './modules/prospects/prospects.module';
import { StatsModule } from './modules/stats/stats.module';
import { SiteModule } from './modules/site/site.module';
import { BannerModule } from './modules/banner/banner.module';
import { AboutModule } from './modules/about/about.module';
import { UploadModule } from './modules/upload/upload.module';
import { SeedModule } from './modules/seed/seed.module';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { CryptModule } from './modules/crypt/crypt.module';
import { SmtpModule } from './modules/smtp/smtp.module';
import { EmailModule } from './modules/email/email.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { EventsModule } from './modules/events/events.module';
import { FeaturesSectionModule } from './modules/features-section/features-section.module';
import { CountriesSectionModule } from './modules/countries-section/countries-section.module';
import { VideoHighlightSectionModule } from './modules/video-highlight-section/video-highlight-section.module';
import { TeamModule } from './modules/team/team.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRoot(process.env.MONGODB_URI ?? '', {
      dbName: process.env.MONGODB_DB ?? 'seed',
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    CryptModule,
    SmtpModule,
    MailModule,
    EmailModule,
    AuditLogModule,
    AuthModule,
    NewsModule,
    NewsCategoryModule,
    ResourcesModule,
    ProgramsModule,
    PartnersModule,
    ContactModule,
    ProspectsModule,
    StatsModule,
    SiteModule,
    BannerModule,
    AboutModule,
    UploadModule,
    UsersModule,
    AnnouncementsModule,
    EventsModule,
    FeaturesSectionModule,
    CountriesSectionModule,
    VideoHighlightSectionModule,
    TeamModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
