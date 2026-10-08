import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AvisService } from './avis.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAvisDto } from './dto/create-avis.dto';
import { UpdateAvisDto } from './dto/update-avis.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('avis')
export class AvisController {
  constructor(private readonly avisService: AvisService) {}

  @Public()
  @Get()
  findAllPublic() {
    return this.avisService.findAllPublic();
  }

  @Get('all')
  findAll(@Query() query: { page?: number; limit?: number; search?: string }) {
    return this.avisService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.avisService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAvisDto) {
    return this.avisService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAvisDto) {
    return this.avisService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.avisService.remove(id);
  }
}