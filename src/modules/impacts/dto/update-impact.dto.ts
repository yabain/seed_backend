import { PartialType } from '@nestjs/mapped-types';
import { CreateImpactDto } from './create-impact.dto';

export class UpdateImpactDto extends PartialType(CreateImpactDto) {}
