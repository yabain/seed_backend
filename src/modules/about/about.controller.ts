import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { AboutService } from './about.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateAboutDto } from './dto/update-about.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Public()
  @Get()
  getPublicAbout() {
    return this.aboutService.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateAboutDto) {
    return this.aboutService.update(dto);
  }
}
