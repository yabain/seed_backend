import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ANNOUNCEMENT_GROUPS,
} from '../schemas/announcement.schema';
import { AttachmentDto } from './attachment.dto';

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
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @IsBoolean()
  @IsOptional()
  includeHeader?: boolean;

  @IsBoolean()
  @IsOptional()
  includeFooter?: boolean;
}
