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
import { ResourcesService } from './resources.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // ---------- Espace public ----------
  @Public()
  @Get()
  findPublic(
    @Query() query: { page?: number; limit?: number; category?: string },
  ) {
    return this.resourcesService.findPublic(query);
  }

  @Public()
  @Get('categories')
  findCategories() {
    return this.resourcesService.findCategories();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  // ---------- Back-office (admin) ----------
  @Post()
  @Roles('admin', 'superadmin')
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}
