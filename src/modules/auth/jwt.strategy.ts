import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Admin, AdminDocument } from './schemas/admin.schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'seed-dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const admin = await this.adminModel.findById(payload.sub).lean().exec();
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException(
        'Votre compte est désactivé ou n’existe plus.',
      );
    }
    return { id: payload.sub, email: admin.email, role: admin.role };
  }
}
