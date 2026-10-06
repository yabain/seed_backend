import { IsArray, IsIn, IsString, ArrayMaxSize, MaxLength } from 'class-validator';
import type { TranslationLang } from '../../platform-settings/platform-settings.schema';

const MAX_TEXTS = 500;
const MAX_TEXT_LENGTH = 5000;

export class TranslateDto {
  @IsIn(['fr', 'en'])
  targetLang: TranslationLang;

  @IsArray()
  @ArrayMaxSize(MAX_TEXTS)
  @IsString({ each: true })
  @MaxLength(MAX_TEXT_LENGTH, { each: true })
  texts: string[];
}