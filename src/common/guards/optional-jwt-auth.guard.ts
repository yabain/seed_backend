import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Garde d'authentification **facultative**.
 *
 * Elle tente d'authentifier la requête (jeton JWT en cookie HttpOnly) afin de
 * renseigner `req.user`, mais **n'échoue jamais** si aucun jeton valide n'est
 * présent : la route reste accessible aux visiteurs anonymes.
 *
 * C'est la pièce qui permet à Orizia d'être utilisable depuis le front office
 * sans compte, tout en conservant l'historique permanent des utilisateurs
 * connectés.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Visiteur anonyme ou jeton expiré : ce n'est pas une erreur.
    }
    return true;
  }

  handleRequest<TUser = any>(_err: any, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
