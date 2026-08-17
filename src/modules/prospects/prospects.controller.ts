/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProspectsService } from './prospects.service';
import { CreateProspectDto } from './dto/prospect.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('prospects')
export class ProspectsPublicController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('subscribe')
  subscribe(@Body() dto: CreateProspectDto) {
    return this.prospectsService.create(dto);
  }
}

@Controller('prospects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.prospectsService.list(
      page ? Number(page) : 1,
      limit ? Number(limit) : 25,
      keyword,
    );
  }

  @Post()
  create(@Body() dto: CreateProspectDto) {
    return this.prospectsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateProspectDto) {
    return this.prospectsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prospectsService.delete(id);
  }

  @Get('export')
  async export(@Req() req: any) {
    const buffer = await this.prospectsService.exportExcel();
    const res = req.res;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=prospects.xlsx');
    res.end(buffer);
  }

  @Get('template')
  async template(@Req() req: any) {
    const buffer = await this.prospectsService.downloadTemplate();
    const res = req.res;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=prospects-template.xlsx',
    );
    res.end(buffer);
  }

  @Post('import')
  async import(@Req() req: any, @Body() body: { file: string }) {
    const base64 = body.file;
    const buffer = Buffer.from(base64, 'base64');
    const result = await this.prospectsService.importExcel(buffer);
    return result;
  }
}
