import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const HEX_COLOR_REGEX = /^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|)$/;

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
  @Matches(HEX_COLOR_REGEX, {
    message: 'Couleur primaire invalide : utilisez un code hexadécimal (ex: #0bcc9c)',
  })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'Couleur secondaire invalide : utilisez un code hexadécimal (ex: #134e4a)',
  })
  secondaryColor?: string;

  @IsOptional()
  social?: SocialDto;

  @IsOptional()
  segments?: SegmentsDto;
}
