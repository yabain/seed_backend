/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TOKEN_COOKIE_NAME } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { SendTwoFactorCodeDto } from './dto/send-two-factor-code.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  // Le frontend et l'API sont hébergés sur des sites différents en production
  // (ex. seeds.yaba-in.com ↔ seeds.racciram.org). Un cookie SameSite=Lax n'est
  // PAS envoyé lors des requêtes cross-site (XHR/fetch), ce qui provoque une
  // déconnexion immédiate. `SameSite=None; Secure` est requis pour autoriser
  // le jeton en cross-site en production (HTTPS). En dev (localhost, même
  // site), on garde `Lax` qui est plus sûr.
  sameSite: IS_PRODUCTION ? ('none' as const) : ('lax' as const),
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    const result = await this.authService.googleLogin(
      googleLoginDto,
      ip,
      userAgent,
    );
    res.cookie(TOKEN_COOKIE_NAME, result.accessToken, COOKIE_OPTIONS);
    return {
      admin: result.admin,
    };
  }

  @Get('me')
  getMe(@CurrentUser() currentUser: { id: string }) {
    return this.authService.getProfile(currentUser.id);
  }

  @Patch('me')
  updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.authService.updateProfile(currentUser.id, dto);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.login(loginDto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/send-code')
  sendTwoFactorCode(
    @Body() sendTwoFactorCodeDto: SendTwoFactorCodeDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.sendTwoFactorCode(
      sendTwoFactorCodeDto,
      ip,
      userAgent,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  async verifyTwoFactor(
    @Body() verifyTwoFactorDto: VerifyTwoFactorDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    const result = await this.authService.verifyTwoFactor(
      verifyTwoFactorDto,
      ip,
      userAgent,
    );
    res.cookie(TOKEN_COOKIE_NAME, result.accessToken, COOKIE_OPTIONS);
    return {
      admin: result.admin,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.forgotPassword(forgotPasswordDto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.resetPassword(resetPasswordDto, ip, userAgent);
  }
}
