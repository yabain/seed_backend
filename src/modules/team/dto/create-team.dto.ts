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

export class TeamSocialLinksDto {
  @IsOptional() @IsString() @MaxLength(300) facebook?: string;
  @IsOptional() @IsString() @MaxLength(300) twitter?: string;
  @IsOptional() @IsString() @MaxLength(300) x?: string;
  @IsOptional() @IsString() @MaxLength(300) linkedin?: string;
  @IsOptional() @IsString() @MaxLength(300) instagram?: string;
}

export class TeamSectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre de la section est obligatoire' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TeamMemberDto {
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
  @Type(() => TeamSocialLinksDto)
  socialLinks?: TeamSocialLinksDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];
}

export class CreateTeamDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamSectionDto)
  sections?: TeamSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members?: TeamMemberDto[];
}

export class UpdateTeamDto extends CreateTeamDto {}
