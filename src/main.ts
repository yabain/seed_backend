import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { resolveUploadDir } from './common/utils/upload-dir.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');

  // Fichiers uploadés : répertoire persistant (hors dossier de déploiement).
  const staticPath = resolveUploadDir();
  if (!existsSync(staticPath)) {
    mkdirSync(staticPath, { recursive: true });
  }
  app.useStaticAssets(staticPath, { prefix: '/uploads/' });

  app.enableCors({
    origin: process.env.CLIENT_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 SEED API démarrée sur http://localhost:${process.env.PORT ?? 3000}`,
  );
}
void bootstrap();
