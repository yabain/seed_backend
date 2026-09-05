import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DonationsService } from './donations.service';
import { CreateDonationMethodDto } from './dto/create-donation-method.dto';
import { UpdateDonationMethodDto } from './dto/update-donation-method.dto';
import { DonationMethod, DonationMethodDocument } from './schemas/donation-method.schema';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Public()
  @Get()
  getActiveMethods(): Promise<DonationMethodDocument[]> {
    return this.donationsService.findAllActive();
  }

  @Get('all')
  getAllMethods(): Promise<DonationMethod[]> {
    return this.donationsService.findAll();
  }

  @Get(':id')
  getMethod(@Param('id') id: string): Promise<DonationMethod> {
    return this.donationsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'superadmin')
  createMethod(
    @Body() dto: CreateDonationMethodDto,
  ): Promise<DonationMethod> {
    return this.donationsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  updateMethod(
    @Param('id') id: string,
    @Body() dto: UpdateDonationMethodDto,
  ): Promise<DonationMethod> {
    return this.donationsService.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles('admin', 'superadmin')
  async toggleMethod(@Param('id') id: string): Promise<DonationMethod> {
    return this.donationsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  async deleteMethod(@Param('id') id: string): Promise<void> {
    return this.donationsService.delete(id);
  }
}