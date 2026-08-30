import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVideoHighlightSectionDto {
  @IsOptional() @IsString() @MaxLength(100) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
  @IsOptional() @IsString() @MaxLength(100) buttonLabel?: string;
  @IsOptional() @IsString() @MaxLength(1000) buttonLink?: string;
  @IsOptional() @IsString() @MaxLength(1000) videoUrl?: string;
  @IsOptional() @IsBoolean() visible?: boolean;
}
