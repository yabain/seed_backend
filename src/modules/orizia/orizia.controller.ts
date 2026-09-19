import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { AskOriziaDto } from './dto/ask-orizia.dto';
import { OriziaService } from './orizia.service';

@Controller('orizia')
export class OriziaController {
  private readonly logger = new Logger(OriziaController.name);

  constructor(private readonly oriziaService: OriziaService) {}

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
      const { stream, conversationId } = await this.oriziaService.ask(dto, req.user);
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
        (error as any)?.response?.message ??
        'Impossible de contacter Orizia pour le moment. Merci de réessayer plus tard.';
      write({ error: Array.isArray(message) ? message.join(' ') : message });
      res.end();
    }
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
