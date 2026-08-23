import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { BannerService } from './banner.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Public()
  @Get()
  getPublicBanner() {
    return this.bannerService.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateBannerDto) {
    return this.bannerService.update(dto);
  }
}
