import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RECRUITMENT_CAMPAIGN_STATUSES,
  RECRUITMENT_FIELD_TYPES,
  RECRUITMENT_FILE_KINDS,
  type RecruitmentCampaignStatus,
  type RecruitmentFieldType,
  type RecruitmentFileKind,
} from '../schemas/recruitment-campaign.schema';

export class RecruitmentDownloadableFileDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;
}

export class RecruitmentFormFieldDto {
  @IsString()
  @IsNotEmpty({ message: 'La clé du champ est obligatoire.' })
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'La clé du champ doit contenir uniquement des lettres minuscules, chiffres et underscores.',
  })
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'Le libellé du champ est obligatoire.' })
  @MaxLength(120)
  label: string;

  @IsEnum(RECRUITMENT_FIELD_TYPES, {
    message:
      'Type de champ invalide (text, textarea, email, number, url, tel, file).',
  })
  type: RecruitmentFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  helpText?: string;

  @IsOptional()
  @IsEnum(RECRUITMENT_FILE_KINDS, {
    message: 'Nature de fichier invalide (any, image, document).',
  })
  fileKind?: RecruitmentFileKind;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxSizeMb?: number;
}

export class CreateRecruitmentCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire.' })
  @MaxLength(220)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, {
    message: 'La description brève ne doit pas dépasser 300 caractères.',
  })
  description?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsDateString({}, { message: 'Date de début invalide.' })
  startsAt: string;

  @IsDateString({}, { message: 'Date de fin invalide.' })
  endsAt: string;

  @IsOptional()
  @IsEnum(RECRUITMENT_CAMPAIGN_STATUSES, {
    message: 'Statut invalide (published, archived).',
  })
  status?: RecruitmentCampaignStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentDownloadableFileDto)
  downloadableFile?: RecruitmentDownloadableFileDto;

  @IsOptional()
  @IsBoolean()
  isVisibleOnLanding?: boolean;

  @IsArray({ message: 'Le formulaire doit contenir une liste de champs.' })
  @ValidateNested({ each: true })
  @Type(() => RecruitmentFormFieldDto)
  formFields: RecruitmentFormFieldDto[];
}
