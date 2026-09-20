import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  RECRUITMENT_APPLICATION_STATUSES,
  type RecruitmentApplicationStatus,
} from '../schemas/recruitment-application.schema';

export class UpdateRecruitmentApplicationStatusDto {
  @IsEnum(RECRUITMENT_APPLICATION_STATUSES, {
    message: 'Statut invalide (pending, approved, rejected).',
  })
  status: RecruitmentApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
