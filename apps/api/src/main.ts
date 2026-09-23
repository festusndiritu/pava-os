import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });

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

  await app.listen(port, '0.0.0.0');

  console.log(`API listening on http://0.0.0.0:${port}`);
  console.log(`Swagger docs: http://0.0.0.0:${port}/docs`);
}

bootstrap();
