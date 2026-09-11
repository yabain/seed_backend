import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { resolveUploadDir } from './common/utils/upload-dir.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');

  // Désactiver la mise en cache HTTP des réponses API (évite les données obsolètes sur navigateurs et proxys)
  app.use((req: any, res: any, next: any) => {
    if (!req.path?.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });

  app.use(cookieParser());

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
    `🚀 API démarrée sur http://localhost:${process.env.PORT ?? 3000}`,
  );
}
void bootstrap();
