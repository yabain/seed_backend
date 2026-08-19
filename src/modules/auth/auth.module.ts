import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { Admin, AdminSchema } from './schemas/admin.schema';
import {
  TwoFactorCode,
  TwoFactorCodeSchema,
} from './schemas/two-factor-code.schema';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SiteModule } from '../site/site.module';

@Module({
  imports: [
    SiteModule,
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: TwoFactorCode.name, schema: TwoFactorCodeSchema },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'seed-dev-secret',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '7d',
        },
      }),
    }),
    AuditLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
