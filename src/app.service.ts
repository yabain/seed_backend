import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getInfo() {
    return {
      name: 'SEED API',
      description:
        'Plateforme web institutionnelle de l’organisation SEED - Yaba-In SARL',
      version: '0.1.0',
      documentation: 'Voir le README.md pour la procédure de démarrage local.',
      status: 'online',
      timestamp: new Date().toISOString(),
    };
  }

  getConfig() {
    return {
      database: 'MongoDB Atlas',
      cache: process.env.REDIS_ENABLED === 'true' ? 'Redis' : 'none',
    };
  }
}
