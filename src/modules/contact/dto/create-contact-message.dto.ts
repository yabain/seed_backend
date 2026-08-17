import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Votre nom est obligatoire' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'Numéro invalide — utilisez l’indicatif international (ex : +225 0700000000)',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le sujet est obligatoire' })
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Le message est obligatoire' })
  @MinLength(10, { message: 'Le message doit contenir au moins 10 caractères' })
  @MaxLength(5000)
  message: string;

  @IsOptional()
  ip?: string;
}
