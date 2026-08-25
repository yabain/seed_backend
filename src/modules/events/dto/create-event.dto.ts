import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { EventStatus } from '../schemas/event.schema';

class PanelistDto {
  @IsOptional()
  @IsString()
  photo?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du panéliste est obligatoire' })
  name: string;

  @IsOptional()
  @IsString()
  title?: string;
}

class SocialLinksDto {
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  x?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsDateString({}, { message: 'Date de début invalide' })
  startDate: string;

  @IsDateString({}, { message: 'Date de fin invalide' })
  endDate: string;

  @IsOptional()
  @IsEnum(['soon', 'currently', 'ended'], {
    message: 'Statut invalide (soon, currently, ended)',
  })
  status?: EventStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  program?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @IsOptional()
  @IsString()
  phone1?: string;

  @IsOptional()
  @IsString()
  phone2?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanelistDto)
  panelists?: PanelistDto[];

  @IsOptional()
  @IsString()
  registrationLink?: string;

  @IsOptional()
  @IsBoolean()
  isVisibleOnLanding?: boolean;
}
