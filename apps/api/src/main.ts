import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim());
  app.enableCors({ origin: webOrigins, credentials: true, exposedHeaders: ['X-Total-Count'] });
  // Cookies ride along on any request the browser makes, so a state-changing call from another site is refused outright.
  app.use((req: any, res: any, next: () => void) => {
    const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (!safe && req.headers.origin && !webOrigins.includes(req.headers.origin)) return res.status(403).json({ message: 'Origin not allowed' });
    next();
  });

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.getHttpAdapter().get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

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