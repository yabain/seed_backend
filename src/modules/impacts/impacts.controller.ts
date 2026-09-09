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
import { ImpactsService } from './impacts.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateImpactDto } from './dto/create-impact.dto';
import { UpdateImpactDto } from './dto/update-impact.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('impacts')
export class ImpactsController {
  constructor(private readonly impactsService: ImpactsService) {}

  @Public()
  @Get()
  findAllPublic() {
    return this.impactsService.findAllPublic();
  }

  @Get('all')
  @Roles('admin', 'superadmin')
  findAll(@Query() query: { page?: number; limit?: number; search?: string }) {
    return this.impactsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.impactsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'superadmin')
  create(@Body() dto: CreateImpactDto) {
    return this.impactsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateImpactDto) {
    return this.impactsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.impactsService.remove(id);
  }
}
