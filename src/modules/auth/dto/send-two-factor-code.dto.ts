import { IsEmail } from 'class-validator';

export class SendTwoFactorCodeDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;
}
