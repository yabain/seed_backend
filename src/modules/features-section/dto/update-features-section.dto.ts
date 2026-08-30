import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class FeatureItemDto {
  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class UpdateFeaturesSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureItemDto)
  features?: FeatureItemDto[];

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
