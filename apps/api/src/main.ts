import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({ origin: true, credentials: true });

  // Uploaded product photos live outside the compiled dist/ folder so they
  // survive a rebuild. Served at /uploads/products/<file>.
  const uploadsDir = join(process.cwd(), 'uploads', 'products');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pava Hardware API')
    .setDescription('API documentation for Pava Hardware')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;

  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();