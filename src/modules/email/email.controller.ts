import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

class SendTestMailDto {
  @IsEmail({}, { message: 'Adresse e-mail de test invalide' })
  @IsNotEmpty({ message: "L'adresse e-mail de test est requise" })
  to: string;

  @IsString()
  @IsNotEmpty({ message: 'Le sujet est requis' })
  subject: string;

  @IsString()
  message: string;
}

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  getOutputMails(
    @Query('page') page?: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ) {
    return this.emailService.getOutputMails(
      page ? Number(page) : 1,
      keyword,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('get-statistics')
  getStatistics() {
    return this.emailService.getEmailStatsByMonth();
  }

  @Post('send-test')
  sendTestMail(@Body() body: SendTestMailDto) {
    return this.emailService.sendTestMail(body.to, body.subject, body.message);
  }
}
