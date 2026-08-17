import { Type } from 'class-transformer';
import {
  IsArray,
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

export class UpdateBannerDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerSlideDto)
  slides: BannerSlideDto[];
}
