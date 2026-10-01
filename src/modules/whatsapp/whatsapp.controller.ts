import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SendWhatsappTestDto } from './dto/send-whatsapp-test.dto';
import { WhatsappService } from './whatsapp.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  status() {
    return this.whatsappService.getStatus();
  }

  @Get('health')
  health() {
    return this.whatsappService.getHealth();
  }

  @Get('qr')
  qr() {
    return this.whatsappService.getQr();
  }

  @Post('reset')
  async reset() {
    await this.whatsappService.reset();
    return { success: true, message: 'Session réinitialisée' };
  }

  @Post('send-test')
  sendTest(@Body() dto: SendWhatsappTestDto) {
    return this.whatsappService.sendText(dto.phone, dto.message);
  }
}

