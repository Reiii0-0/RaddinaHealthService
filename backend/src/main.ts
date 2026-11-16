import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export async function configureApp(app: NestExpressApplication) {
  const uploadsRoot = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsRoot, 'medicines'), { recursive: true });
  mkdirSync(join(uploadsRoot, 'invoices'), { recursive: true });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  return app;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await configureApp(app);
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Raddina Health Service Backend berjalan di http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap();
}
