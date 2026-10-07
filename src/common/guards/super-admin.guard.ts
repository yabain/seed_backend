import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Restreint une route aux utilisateurs de rôle EXACTEMENT `superadmin`
 * (pas la hiérarchie de `RolesGuard`, qui autoriserait aussi `admin`).
 * À utiliser sur les opérations sensibles (backup/restauration).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    return request.user?.role === 'superadmin';
  }
}