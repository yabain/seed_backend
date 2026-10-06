import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateWhatsappGatewayDto } from './dto/update-whatsapp-gateway.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PlatformSettingsService } from './platform-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  @Get('whatsapp-gateway')
  getWhatsappGateway() {
    return this.settingsService.getWhatsappGateway();
  }

  @Patch('whatsapp-gateway')
  updateWhatsappGateway(@Body() dto: UpdateWhatsappGatewayDto) {
    return this.settingsService.updateWhatsappGateway(dto);
  }

  @Get('translation')
  getTranslation() {
    return this.settingsService.getTranslationSettings();
  }

  @Patch('translation')
  updateTranslation(@Body() dto: UpdateTranslationDto) {
    return this.settingsService.updateTranslationSettings(dto);
  }

  /** Version publique (bouton flottant) : aucun secret, accessible sans auth. */
  @Public()
  @Get('translation/public')
  getPublicTranslation() {
    return this.settingsService.getPublicTranslationSettings();
  }

  @Get('auth')
  getAuth() {
    return this.settingsService.getAuthSettings();
  }

  @Patch('auth')
  updateAuth(@Body() dto: UpdateAuthDto) {
    return this.settingsService.updateAuthSettings(dto);
  }

  /**
   * Version publique pour la page de connexion (2FA + bouton Google).
   * Le GOOGLE_CLIENT_ID est renvoyé CHIFFRÉ (le front le déchiffre avec sa
   * clé) ; il n'est jamais exposé en clair.
   */
  @Public()
  @Get('auth/public')
  getPublicAuth() {
    return this.settingsService.getPublicAuthSettings();
  }
}
