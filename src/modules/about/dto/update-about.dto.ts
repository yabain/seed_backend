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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  visual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  titleLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  titleLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sectionDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  floatingCard1Icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  floatingCard1Label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  floatingCard1Value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  floatingCard2Icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  floatingCard2Label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  floatingCard2Value?: string;
}
