import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const HEX_COLOR_REGEX = /^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|)$/;

/** Nombre maximum de sous-menus pour l'item « hover menu ». */
export const HOVER_MENU_MAX_ITEMS = 4;

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

  @IsOptional()
  @IsBoolean()
  events?: boolean;

  @IsOptional()
  @IsBoolean()
  team?: boolean;

  @IsOptional()
  @IsBoolean()
  donations?: boolean;
}

export class LandingSectionTextDto {
  @IsOptional() @IsString() @MaxLength(100) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) buttonLabel?: string;
}

export class LandingSectionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  events?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  news?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  programs?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  partners?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  resources?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  team?: LandingSectionTextDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionTextDto)
  donations?: LandingSectionTextDto;
}

export class HoverMenuItemDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  /** URL externe (`http://` / `https://`) ou route interne (`/programs`). */
  @IsOptional() @IsString() @MaxLength(1000) link?: string;
}

export class HoverMenuDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(120) title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HOVER_MENU_MAX_ITEMS, {
    message: `Maximum ${HOVER_MENU_MAX_ITEMS} sous-menus sont autorisés.`,
  })
  @ValidateNested({ each: true })
  @Type(() => HoverMenuItemDto)
  items?: HoverMenuItemDto[];
}

export class OriziaDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(300)
  openRouterApiKey?: string;

  @IsOptional()
  temperature?: number;

  @IsOptional()
  @Matches(/^(low|medium|high)$/i, {
    message: 'Niveau de réflexion invalide (low, medium, high).',
  })
  reasoningLevel?: string;
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
    message:
      'Couleur primaire invalide : utilisez un code hexadécimal (ex: #0bcc9c)',
  })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message:
      'Couleur secondaire invalide : utilisez un code hexadécimal (ex: #134e4a)',
  })
  secondaryColor?: string;

  @IsOptional()
  social?: SocialDto;

  @IsOptional()
  segments?: SegmentsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LandingSectionsDto)
  landingSections?: LandingSectionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HoverMenuDto)
  hoverMenu?: HoverMenuDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OriziaDto)
  orizia?: OriziaDto;
}
