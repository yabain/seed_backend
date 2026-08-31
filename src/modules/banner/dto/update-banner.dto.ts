import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BannerSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class BannerFigureDto {
  @IsString() @MaxLength(30) value: string;
  @IsString() @MaxLength(100) label: string;
}

export class UpdateBannerDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerSlideDto)
  slides: BannerSlideDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fixedText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  rotatingPhrases?: string[];

  @IsOptional()
  @IsString()
  rotatingImage?: string;

  @IsOptional()
  @IsBoolean()
  rotatingVisible?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerFigureDto)
  figures?: BannerFigureDto[];

  @IsOptional()
  @IsString()
  authBackgroundImage?: string;

  @IsOptional()
  @IsString()
  pageBackgroundImage?: string;
}
