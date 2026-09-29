import { IsNumber, IsOptional, Min } from 'class-validator';

export class PublicStatsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}