import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVirtualTourSectionDto {
  @IsOptional() @IsString() @MaxLength(100) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) url?: string;
  @IsOptional() @IsBoolean() visible?: boolean;
}
