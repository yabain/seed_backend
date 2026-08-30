import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateVideoHighlightSectionDto } from './dto/update-video-highlight-section.dto';
import { VideoHighlightSectionService } from './video-highlight-section.service';

@Roles('admin', 'superadmin')
@Controller('video-highlight-section')
export class VideoHighlightSectionController {
  constructor(private readonly service: VideoHighlightSectionService) {}
  @Public() @Get() getPublic() { return this.service.getPublic(); }
  @Put() update(@Body() dto: UpdateVideoHighlightSectionDto) { return this.service.update(dto); }
}
