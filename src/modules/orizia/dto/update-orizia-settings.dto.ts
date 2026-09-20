import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOriziaSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  welcomeImage?: string;

  /**
   * Clé OpenRouter en clair côté entrée API.
   * Elle est chiffrée avant la sauvegarde en base.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  openRouterApiKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  reasoningLevel?: 'low' | 'medium' | 'high';
}
