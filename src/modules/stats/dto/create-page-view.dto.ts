import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePageViewDto {
  @IsString()
  @IsNotEmpty({ message: 'Le chemin est obligatoire' })
  @MaxLength(200)
  path: string;

  @IsString()
  @IsNotEmpty({ message: 'La clé de visiteur est obligatoire' })
  @MaxLength(64)
  visitorId: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
