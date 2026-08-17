import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAboutDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  vision?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  values?: string[];
}
