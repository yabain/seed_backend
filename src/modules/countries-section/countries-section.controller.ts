import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { CountriesSectionService } from './countries-section.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateCountriesSectionDto } from './dto/update-countries-section.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('countries-section')
export class CountriesSectionController {
  constructor(private readonly countriesSectionService: CountriesSectionService) {}

  @Public()
  @Get()
  getPublic() {
    return this.countriesSectionService.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateCountriesSectionDto) {
    return this.countriesSectionService.update(dto);
  }
}