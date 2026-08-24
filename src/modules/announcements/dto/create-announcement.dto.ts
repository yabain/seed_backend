import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ANNOUNCEMENT_GROUPS,
} from '../schemas/announcement.schema';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(255)
  subject!: string;

  @IsString()
  bodyHtml!: string;

  @IsEnum(ANNOUNCEMENT_GROUPS)
  recipientGroup!: string;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  customRecipients?: string[];

  @IsArray()
  @IsOptional()
  attachments?: Array<{
    fileName: string;
    path: string;
    size: number;
  }>;

  @IsBoolean()
  @IsOptional()
  includeHeader?: boolean;

  @IsBoolean()
  @IsOptional()
  includeFooter?: boolean;
}
