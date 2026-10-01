import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWhatsappGatewayDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
