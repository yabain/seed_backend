import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateSectionTextDto {
  @IsOptional() @IsString() @MaxLength(100) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) buttonLabel?: string;
  @IsOptional() @IsString() @MaxLength(2000) backgroundImage?: string;
  @IsOptional() @IsBoolean() visible?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  items?: Array<{ question?: string; answer?: string }>;
}

export class UpdateIdentityDto {
  @IsOptional() @IsString() @MaxLength(200) orgName?: string;
  @IsOptional() @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() footerLogo?: string;
  @IsOptional() @IsString() favicon?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsString() @MaxLength(300) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) heroSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(50) phone2?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|)$/) primaryColor?: string;
  @IsOptional() @Matches(/^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|)$/) secondaryColor?: string;
}

export class UpdateSocialDto {
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() linkedin?: string;
  @IsOptional() @IsString() twitter?: string;
  @IsOptional() @IsString() youtube?: string;
}

export class UpdateSegmentsDto {
  @IsOptional() @IsBoolean() news?: boolean;
  @IsOptional() @IsBoolean() resources?: boolean;
  @IsOptional() @IsBoolean() programs?: boolean;
  @IsOptional() @IsBoolean() partners?: boolean;
  @IsOptional() @IsBoolean() events?: boolean;
  @IsOptional() @IsBoolean() team?: boolean;
  @IsOptional() @IsBoolean() donations?: boolean;
  @IsOptional() @IsBoolean() recruitments?: boolean;
  @IsOptional() @IsBoolean() avis?: boolean;
}

export class UpdateNavVisibilityDto {
  @IsOptional() @IsBoolean() news?: boolean;
  @IsOptional() @IsBoolean() resources?: boolean;
  @IsOptional() @IsBoolean() programs?: boolean;
  @IsOptional() @IsBoolean() partners?: boolean;
  @IsOptional() @IsBoolean() events?: boolean;
  @IsOptional() @IsBoolean() team?: boolean;
  @IsOptional() @IsBoolean() donations?: boolean;
  @IsOptional() @IsBoolean() recruitments?: boolean;
  @IsOptional() @IsBoolean() avis?: boolean;
}

export class UpdateHoverMenuDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(120) title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  items?: Array<{ title?: string; description?: string; link?: string }>;
}