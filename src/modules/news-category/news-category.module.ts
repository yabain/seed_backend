import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsCategoryController } from './news-category.controller';
import { NewsCategoryService } from './news-category.service';
import { NewsCategory, NewsCategorySchema } from './schemas/news-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NewsCategory.name, schema: NewsCategorySchema }]),
  ],
  controllers: [NewsCategoryController],
  providers: [NewsCategoryService],
  exports: [NewsCategoryService],
})
export class NewsCategoryModule {}