import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeamSectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre de la section est obligatoire' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}