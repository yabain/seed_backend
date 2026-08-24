import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAnnouncementSettingsDto {
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  headerHtml!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50000)
  footerHtml!: string;
}
