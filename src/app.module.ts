import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '@/src/modules/users/users.module';
import { AuthMiddleware } from '@/src/middleware/auth.middleware';
import { LoggerModule } from '@/src/modules/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    AuthModule,
    UsersModule,
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
