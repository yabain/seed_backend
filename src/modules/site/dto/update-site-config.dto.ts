import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SocialDto {
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  youtube?: string;
}

export class SegmentsDto {
  @IsOptional()
  @IsBoolean()
  news?: boolean;

  @IsOptional()
  @IsBoolean()
  resources?: boolean;

  @IsOptional()
  @IsBoolean()
  programs?: boolean;

  @IsOptional()
  @IsBoolean()
  partners?: boolean;
}

export class UpdateSiteConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  orgName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  favicon?: string;

  @IsOptional()
  @IsString()
  ogImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  heroTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone2?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contact invalide' })
  email?: string;

  @IsOptional()
  social?: SocialDto;

  @IsOptional()
  segments?: SegmentsDto;
}
