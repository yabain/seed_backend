import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { FeaturesSectionService } from './features-section.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateFeaturesSectionDto } from './dto/update-features-section.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('features-section')
export class FeaturesSectionController {
  constructor(private readonly featuresSectionService: FeaturesSectionService) {}

  @Public()
  @Get()
  getPublic() {
    return this.featuresSectionService.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateFeaturesSectionDto) {
    return this.featuresSectionService.update(dto);
  }
}