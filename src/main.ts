import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationError, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppException } from './common/app.exception';

function firstValidationMessage(errors: ValidationError[]): string {
  for (const err of errors) {
    if (err.constraints) return Object.values(err.constraints)[0];
    if (err.children?.length) {
      const nested = firstValidationMessage(err.children);
      if (nested) return nested;
    }
  }
  return 'Validatsiya xatosi';
}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET .env faylida ko'rsatilishi shart");
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // api-contract.md: Base URL .../v1
  app.setGlobalPrefix('v1');

  // Diqqat: helmet statik fayllardan OLDIN ulanadi, aks holda /admin javoblariga
  // xavfsizlik sarlavhalari qo'shilmay qoladi.
  //
  // Admin panel o'z fayllaridan iborat (tashqi CDN yo'q) — qat'iy CSP mos keladi.
  // Swagger UI esa inline skript ishlatadi, shuning uchun /docs uchun CSP o'chiriladi.
  const secure = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  });
  const secureNoCsp = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/docs') ? secureNoCsp(req, res, next) : secure(req, res, next),
  );

  // Admin panel (statik): http://localhost:3001/admin
  app.useStaticAssets(join(__dirname, '..', 'public', 'admin'), { prefix: '/admin' });
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
      : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new AppException('VALIDATION_ERROR', firstValidationMessage(errors), 400),
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("O'quv markaz API")
    .setDescription("O'quv markaz platformasi backend — api-contract.md asosida qurilgan")
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);
  /* eslint-disable no-console */
  console.log(`API:         http://localhost:${port}/v1`);
  console.log(`Admin panel: http://localhost:${port}/admin`);
  console.log(`Swagger:     http://localhost:${port}/docs`);
}

void bootstrap();
