import { Body, Controller, Get, Put } from '@nestjs/common';
import { AboutService } from './about.service';
import { UpdateAboutDto } from './dto/update-about.dto';
import { Public } from '../../common/decorators/public.decorator';

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
