import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { NewsStatus } from '../schemas/news.schema';

const MEDIA_URL_PATTERN = /^(?:https?:\/\/[^\s"'<>]+|\/uploads\/[^\s"'<>]+)$/i;

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le contenu est obligatoire' })
  content: string;

  @IsString()
  @IsNotEmpty({ message: 'L’image principale est obligatoire' })
  @Matches(MEDIA_URL_PATTERN, {
    message: 'L’image principale doit être une URL valide',
  })
  @MaxLength(2048)
  image: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4, { message: 'La galerie ne peut pas dépasser 4 images' })
  @IsString({ each: true })
  @Matches(MEDIA_URL_PATTERN, {
    each: true,
    message: 'Chaque image de la galerie doit être une URL valide',
  })
  @MaxLength(2048, { each: true })
  gallery?: string[];

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsEnum(['draft', 'published'], {
    message: 'Statut invalide (draft ou published)',
  })
  status?: NewsStatus;

  @IsOptional()
  @IsBoolean()
  isVisibleOnLanding?: boolean;
}
