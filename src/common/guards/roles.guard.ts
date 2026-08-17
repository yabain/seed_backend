import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ROLE_LEVEL, UserRole } from '../../modules/auth/schemas/admin.schema';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;
    const userRole = user?.role as UserRole | undefined;

    if (!userRole || !(userRole in ROLE_LEVEL)) {
      return false;
    }

    return requiredRoles.some(
      (required) => ROLE_LEVEL[userRole] >= ROLE_LEVEL[required],
    );
  }
}
