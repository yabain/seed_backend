import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AttachmentDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  path!: string;

  @IsInt()
  @Min(0)
  size!: number;
}
