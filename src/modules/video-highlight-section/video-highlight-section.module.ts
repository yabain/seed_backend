import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoHighlightSectionController } from './video-highlight-section.controller';
import { VideoHighlightSectionService } from './video-highlight-section.service';
import { VideoHighlightSection, VideoHighlightSectionSchema } from './schemas/video-highlight-section.schema';

@Module({ imports: [MongooseModule.forFeature([{ name: VideoHighlightSection.name, schema: VideoHighlightSectionSchema }])], controllers: [VideoHighlightSectionController], providers: [VideoHighlightSectionService] })
export class VideoHighlightSectionModule {}
