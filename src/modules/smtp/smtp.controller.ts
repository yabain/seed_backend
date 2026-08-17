import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SmtpService } from './smtp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SmtpConfig } from './smtp.service';

@Controller('smtp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class SmtpController {
  constructor(private readonly smtpService: SmtpService) {}

  @Get()
  async getSmtp() {
    return this.smtpService.getSmtpData();
  }

  @Put('update')
  async updateSmtp(@Body() data: Partial<SmtpConfig>) {
    return this.smtpService.updateSmtpData(data);
  }

  @Get('reset')
  async resetSmtp() {
    return this.smtpService.resetSmtp();
  }
}
