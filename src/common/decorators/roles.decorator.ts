import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../modules/auth/schemas/admin.schema';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à certains rôles (la hiérarchie est prise en compte :
 * un superadmin peut accéder aux routes réservées 'admin').
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
