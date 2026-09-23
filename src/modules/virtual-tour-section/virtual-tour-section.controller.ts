import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateVirtualTourSectionDto } from './dto/update-virtual-tour-section.dto';
import { VirtualTourSectionService } from './virtual-tour-section.service';

@Roles('admin', 'superadmin')
@Controller('virtual-tour-section')
export class VirtualTourSectionController {
  constructor(private readonly service: VirtualTourSectionService) {}

  @Public()
  @Get()
  getPublic() {
    return this.service.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateVirtualTourSectionDto) {
    return this.service.update(dto);
  }
}
