import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [TranslationController],
  providers: [TranslationService],
})
export class TranslationModule {}