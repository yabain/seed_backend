import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecruitmentApplicationFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Le lien du fichier est obligatoire.' })
  fileUrl: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du fichier est obligatoire.' })
  @MaxLength(220)
  fileName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le type MIME du fichier est obligatoire.' })
  @MaxLength(120)
  fileType: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class RecruitmentApplicationFieldInputDto {
  @IsString()
  @IsNotEmpty({ message: 'La clé du champ est obligatoire.' })
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'La clé du champ doit contenir uniquement des lettres minuscules, chiffres et underscores.',
  })
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  value?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecruitmentApplicationFileDto)
  file?: RecruitmentApplicationFileDto;
}

export class CreateRecruitmentApplicationDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(120)
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MaxLength(120)
  firstName: string;

  @IsArray({ message: 'Les valeurs du formulaire doivent être un tableau.' })
  @ValidateNested({ each: true })
  @Type(() => RecruitmentApplicationFieldInputDto)
  fields: RecruitmentApplicationFieldInputDto[];
}
