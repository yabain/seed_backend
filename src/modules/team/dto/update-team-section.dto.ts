import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamSectionDto } from './create-team-section.dto';

export class UpdateTeamSectionDto extends PartialType(CreateTeamSectionDto) {}
