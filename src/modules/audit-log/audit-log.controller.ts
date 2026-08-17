/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('actionPrefix') actionPrefix?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
    @Query('statusCode') statusCode?: string,
    @Query('method') method?: string,
    @Query('ip') ip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
  ) {
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'superadmin';
    return this.auditLogService.list(Number(page) || 1, Number(limit) || 20, {
      q,
      action,
      actionPrefix,
      resourceType,
      resourceId,
      actorId: isAdmin ? actorId || undefined : req.user?.id || undefined,
      actorRole,
      statusCode,
      method,
      ip,
      from,
      to,
      sort,
    });
  }

  @Get('actions')
  async actions(@Query('prefix') prefix?: string) {
    return { data: await this.auditLogService.distinctActions(prefix) };
  }

  @Get('resource-types')
  async resourceTypes() {
    return { data: await this.auditLogService.distinctResourceTypes() };
  }
}
