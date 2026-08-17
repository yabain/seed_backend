import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNewsCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire' })
  @MaxLength(60)
  name: string;
}

export class UpdateNewsCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire' })
  @MaxLength(60)
  name?: string;
}