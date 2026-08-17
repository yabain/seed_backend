import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateProspectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateProspectDto extends CreateProspectDto {}
