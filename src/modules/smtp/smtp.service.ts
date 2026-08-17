import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Smtp, SmtpDocument } from './smtp.schema';
import { CryptService } from '../crypt/crypt.service';

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpEncryption: string;
  status: boolean;
  emailForAlert: string;
}

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(
    @InjectModel(Smtp.name) private readonly smtpModel: Model<SmtpDocument>,
    private readonly cryptService: CryptService,
    private readonly configService: ConfigService,
  ) {}

  private getEnvPassword(): string {
    return (
      this.configService.get<string>('SMTP_PASS')?.trim() ||
      this.configService.get<string>('SMTP_PASSWORD')?.trim() ||
      ''
    );
  }

  private getEnvSmtpData(): SmtpConfig | null {
    const smtpHost = this.configService.get<string>('SMTP_HOST')?.trim() ?? '';
    if (!smtpHost) return null;

    const smtpUser = this.configService.get<string>('SMTP_USER')?.trim() || '';
    const smtpPassword = this.getEnvPassword();
    if (!smtpUser || !smtpPassword) return null;

    return {
      smtpHost,
      smtpPort: this.configService.get<string>('SMTP_PORT') || '587',
      smtpSecure: this.configService.get<string>('SMTP_SECURE') === 'true',
      smtpUser,
      smtpPassword,
      smtpEncryption: 'SSL/TLS',
      status: true,
      emailForAlert:
        this.configService.get<string>('CONTACT_RECIPIENT_EMAIL') || '',
    };
  }

  async getSmtpData(): Promise<SmtpConfig | null> {
    const doc = await this.smtpModel.findOne().lean().exec();
    if (!doc) {
      const envConfig = this.getEnvSmtpData();
      if (envConfig) {
        this.logger.log(
          'Configuration SMTP chargée depuis le fichier .env (aucune entrée en base).',
        );
        return envConfig;
      }

      const smtpHost = this.configService.get<string>('SMTP_HOST')?.trim();
      if (smtpHost) {
        this.logger.warn(
          'SMTP_HOST défini dans .env mais identifiants incomplets (SMTP_USER et SMTP_PASS ou SMTP_PASSWORD requis).',
        );
      }

      return null;
    }

    let smtpUser = doc.smtpUser;
    let smtpPassword = doc.smtpPassword;

    try {
      if (smtpUser) smtpUser = this.cryptService.decrypt(smtpUser);
      if (smtpPassword) smtpPassword = this.cryptService.decrypt(smtpPassword);
    } catch {
      this.logger.warn(
        'Failed to decrypt SMTP credentials, returning raw values',
      );
    }

    const dbConfig: SmtpConfig = {
      smtpHost: doc.smtpHost,
      smtpPort: doc.smtpPort,
      smtpSecure: doc.smtpSecure,
      smtpUser: smtpUser || '',
      smtpPassword: smtpPassword || '',
      smtpEncryption: doc.smtpEncryption || 'SSL/TLS',
      status: doc.status ?? true,
      emailForAlert: doc.emailForAlert || '',
    };

    if (!dbConfig.smtpHost?.trim()) {
      const envConfig = this.getEnvSmtpData();
      if (envConfig) {
        this.logger.log(
          'Configuration SMTP chargée depuis le fichier .env (hôte manquant en base).',
        );
        return envConfig;
      }
    }

    return dbConfig;
  }

  async updateSmtpData(data: Partial<SmtpConfig>): Promise<SmtpConfig> {
    const updateData: Record<string, unknown> = { ...data };

    if (data.smtpUser) {
      updateData.smtpUser = this.cryptService.encrypt(data.smtpUser);
    }
    if (data.smtpPassword) {
      updateData.smtpPassword = this.cryptService.encrypt(data.smtpPassword);
    }

    const updated = await this.smtpModel
      .findOneAndUpdate({}, updateData, { new: true, upsert: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(
        'Impossible de mettre à jour la configuration SMTP',
      );
    }

    return this.getSmtpData() as Promise<SmtpConfig>;
  }

  async resetSmtp(): Promise<SmtpConfig> {
    const defaults: Partial<SmtpConfig> = {
      smtpHost: this.configService.get<string>('SMTP_HOST') || '',
      smtpPort: this.configService.get<string>('SMTP_PORT') || '587',
      smtpSecure: this.configService.get<string>('SMTP_SECURE') === 'true',
      smtpUser: this.configService.get<string>('SMTP_USER') || '',
      smtpPassword: this.getEnvPassword(),
      smtpEncryption: 'SSL/TLS',
      status: true,
      emailForAlert:
        this.configService.get<string>('CONTACT_RECIPIENT_EMAIL') || '',
    };

    return this.updateSmtpData(defaults);
  }

  async getOrCreateDefault(): Promise<SmtpConfig> {
    const existing = await this.getSmtpData();
    if (existing) return existing;
    return this.resetSmtp();
  }
}
