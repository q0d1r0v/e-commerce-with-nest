import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '@/src/modules/users/users.module';
import { AuthMiddleware } from '@/src/middleware/auth.middleware';
import { LoggerModule } from '@/src/modules/logger/logger.module';
import { FilesModule } from '@/src/modules/files/files.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CategoriesModule } from './modules/categories/categories.module';
import { CurrenciesModule } from './modules/currency/currencies.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    FilesModule,
    LoggerModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CurrenciesModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'open/*path', method: RequestMethod.ALL },
        { path: 'auth/*path', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
