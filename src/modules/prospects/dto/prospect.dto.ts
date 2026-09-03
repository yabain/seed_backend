import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

// Numéro de téléphone international (E.164) après normalisation : préfixe `+`
// facultatif, 8 à 15 chiffres.
const PHONE_PATTERN = /^(\+[1-9][0-9]{7,14}|00[1-9][0-9]{7,14}|[0-9]{8,15})$/;

// Normalise : supprime espaces, points, tirets et parenthèses.
const normalizePhone = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(/[\s().-]/g, '') : value;

export class CreateProspectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(PHONE_PATTERN, {
    message:
      'Numéro de téléphone invalide. Utilisez un format international (ex. +225 07 00 00 00 00).',
  })
  phone?: string;
}

export class UpdateProspectDto extends CreateProspectDto {}
