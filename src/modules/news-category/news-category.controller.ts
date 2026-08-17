import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { NewsCategoryService } from './news-category.service';
import { CreateNewsCategoryDto, UpdateNewsCategoryDto } from './dto/news-category.dto';

@Controller('news-categories')
export class NewsCategoryController {
  constructor(private readonly newsCategoryService: NewsCategoryService) {}

  @Get()
  findAll() {
    return this.newsCategoryService.findAll();
  }

  @Post()
  create(@Body() dto: CreateNewsCategoryDto) {
    return this.newsCategoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNewsCategoryDto) {
    return this.newsCategoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsCategoryService.remove(id);
  }
}