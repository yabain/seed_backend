import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TeamMemberSocialLinksDto {
  @IsOptional() @IsString() @MaxLength(300) facebook?: string;
  @IsOptional() @IsString() @MaxLength(300) twitter?: string;
  @IsOptional() @IsString() @MaxLength(300) x?: string;
  @IsOptional() @IsString() @MaxLength(300) linkedin?: string;
  @IsOptional() @IsString() @MaxLength(300) instagram?: string;
}

export class CreateTeamMemberDto {
  @IsOptional()
  @IsString()
  photo?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du membre est obligatoire' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TeamMemberSocialLinksDto)
  socialLinks?: TeamMemberSocialLinksDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];
}