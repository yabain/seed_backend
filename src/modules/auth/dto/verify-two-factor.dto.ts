import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code est requis' })
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 chiffres' })
  code: string;
}
