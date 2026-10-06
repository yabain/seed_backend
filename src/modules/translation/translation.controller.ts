import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TranslateDto } from './dto/translate.dto';
import { TranslationService } from './translation.service';
import { TranslateResponse } from './translation.types';

@Controller('translate')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  /**
   * Proxy de traduction public : traduit un lot de segments via le moteur
   * configuré (DeepL ou Google). Soumis au throttle pour éviter les abus.
   */
  @Public()
  @Post()
  translate(@Body() dto: TranslateDto): Promise<TranslateResponse> {
    return this.translationService.translate(dto);
  }
}