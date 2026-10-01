import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateWhatsappGatewayDto } from './dto/update-whatsapp-gateway.dto';
import { PlatformSettingsService } from './platform-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  @Get('whatsapp-gateway')
  getWhatsappGateway() {
    return this.settingsService.getWhatsappGateway();
  }

  @Patch('whatsapp-gateway')
  updateWhatsappGateway(@Body() dto: UpdateWhatsappGatewayDto) {
    return this.settingsService.updateWhatsappGateway(dto);
  }
}
