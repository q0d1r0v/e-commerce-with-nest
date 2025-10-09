// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.NODE_ENV === 'development') {
    app.use(
      ['/api/docs'],
      basicAuth({
        challenge: true,
        users: {
          [process.env.SWAGGER_USER || 'dev']:
            process.env.SWAGGER_PASS || '123',
        },
      }),
    );

    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'auth/*path', method: RequestMethod.ALL },
        { path: 'open/*path', method: RequestMethod.ALL },
      ],
    });

    const config = new DocumentBuilder()
      .setTitle('E-commerce API')
      .setDescription('E-commerce API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
