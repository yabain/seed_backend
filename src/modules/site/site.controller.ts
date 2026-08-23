import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { SiteService } from './site.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('site-config')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Public()
  @Get()
  getPublicConfig() {
    return this.siteService.getPublicConfig();
  }

  @Put()
  update(@Body() dto: UpdateSiteConfigDto) {
    return this.siteService.update(dto);
  }
}
