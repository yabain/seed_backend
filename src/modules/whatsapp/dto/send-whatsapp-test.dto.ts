import { IsString, MinLength } from 'class-validator';

export class SendWhatsappTestDto {
  @IsString()
  @MinLength(8)
  phone: string;

  @IsString()
  @MinLength(1)
  message: string;
}
