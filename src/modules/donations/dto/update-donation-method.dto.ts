import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class UpdateDonationMethodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  qrCodeImage?: string;

  @IsOptional()
  @IsString()
  paymentLink?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}