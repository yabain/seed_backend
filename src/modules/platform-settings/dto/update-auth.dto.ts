import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAuthDto {
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  googleLoginEnabled?: boolean;

  /**
   * GOOGLE_CLIENT_ID. Laissé vide pour conserver l'existant (chiffré).
   * Jamais renvoyé en clair au front ; seul `hasGoogleClientId` l'est.
   */
  @IsOptional()
  @IsString()
  googleClientId?: string;
}