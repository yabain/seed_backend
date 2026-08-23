import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ---------- Espace public ----------
  @Public()
  @Post()
  create(@Body() dto: CreateContactMessageDto, @Req() req: Request) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.ip ?? '';
    return this.contactService.create({ ...dto, ip });
  }

  // ---------- Back-office (admin) ----------
  @Get()
  findAll(@Query() query: { page?: number; limit?: number; read?: string }) {
    return this.contactService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Body() dto: UpdateContactMessageDto) {
    return this.contactService.markRead(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactService.remove(id);
  }
}
