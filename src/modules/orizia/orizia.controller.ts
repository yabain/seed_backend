import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { AskOriziaDto } from './dto/ask-orizia.dto';
import { UpdateOriziaSettingsDto } from './dto/update-orizia-settings.dto';
import { OriziaService } from './orizia.service';
import { SiteService } from '../site/site.service';

@Controller('orizia')
export class OriziaController {
  private readonly logger = new Logger(OriziaController.name);

  constructor(
    private readonly oriziaService: OriziaService,
    private readonly siteService: SiteService,
  ) {}

  @Get('settings')
  @Roles('admin', 'superadmin')
  async getSettings() {
    return this.siteService.getOriziaSettingsForAdmin();
  }

  @Put('settings')
  @Roles('admin', 'superadmin')
  async updateSettings(@Body() dto: UpdateOriziaSettingsDto) {
    return this.siteService.updateOriziaSettings(dto);
  }

  /**
   * Pose une question à Orizia et reçoit la réponse en flux SSE.
   *
   * `@Public()` + `OptionalJwtAuthGuard` : l'endpoint est ouvert aux visiteurs
   * anonymes, et `req.user` est renseigné lorsqu'un utilisateur est connecté
   * (auquel cas sa conversation est conservée durablement).
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('ask')
  async ask(@Req() req: any, @Body() dto: AskOriziaDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const write = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { stream, conversationId } = await this.oriziaService.ask(
        dto,
        req.user,
      );
      write({ conversationId });

      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          write({ done: true });
          res.end();
          return;
        }
        write({ text: value });
      }
    } catch (error) {
      this.logger.error(`Erreur Orizia : ${(error as Error).message}`);
      const message =
        error?.response?.message ??
        'Impossible de contacter Orizia pour le moment. Merci de réessayer plus tard.';
      write({ error: Array.isArray(message) ? message.join(' ') : message });
      res.end();
    }
  }

  /**
   * Reprise du fil d'un **visiteur non connecté** à partir de son identifiant
   * daté (`udm-AAAA-MM-JJ-<aléatoire>`) conservé dans le `localStorage`.
   *
   * Endpoint public, mais volontairement limité par le service à la date du jour
   * et aux conversations sans utilisateur rattaché.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('visitor/:visitorId')
  async getVisitorConversation(
    @Param('visitorId') visitorId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.oriziaService.getVisitorConversation(
      visitorId,
      Number(skip) || 0,
      Math.min(Number(limit) || 20, 50),
    );
  }

  /** Dernière conversation de l'utilisateur connecté (reprise à la connexion). */
  @Get('conversations')
  async getLatestConversation(
    @Req() req: any,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.oriziaService.getLatestConversation(
      req.user,
      Number(skip) || 0,
      Math.min(Number(limit) || 20, 50),
    );
  }

  /** Historique paginé d'une conversation (scroll infini vers le haut). */
  @Get('conversation/:id')
  async getConversation(
    @Param('id') id: string,
    @Req() req: any,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.oriziaService.getConversation(
      id,
      req.user,
      Number(skip) || 0,
      Math.min(Number(limit) || 20, 50),
    );
  }
}
