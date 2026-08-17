import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateContactMessageDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
