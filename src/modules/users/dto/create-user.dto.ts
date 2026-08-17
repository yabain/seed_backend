import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_ROLES } from '../../auth/schemas/admin.schema';
import type { UserRole } from '../../auth/schemas/admin.schema';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'Numéro invalide — utilisez l’indicatif international (ex : +225 0700000000)',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(USER_ROLES, { message: 'Rôle invalide' })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyContact?: boolean;
}
