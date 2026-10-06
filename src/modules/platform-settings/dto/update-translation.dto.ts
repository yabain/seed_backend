import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type {
  TranslationLang,
  TranslationProvider,
} from '../platform-settings.schema';

export class UpdateTranslationDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['fr', 'en'])
  defaultLanguage?: TranslationLang;

  @IsOptional()
  @IsIn(['google', 'deepl'])
  provider?: TranslationProvider;

  /**
   * Clé API DeepL. Laissée vide pour conserver la clé existante (chiffrée).
   * N'est jamais renvoyée au front ; seul `hasDeeplKey` l'est.
   */
  @IsOptional()
  @IsString()
  deeplApiKey?: string;
}