import { PartialType } from '@nestjs/mapped-types';
import { CreateRecruitmentCampaignDto } from './create-recruitment-campaign.dto';

export class UpdateRecruitmentCampaignDto extends PartialType(
  CreateRecruitmentCampaignDto,
) {}
