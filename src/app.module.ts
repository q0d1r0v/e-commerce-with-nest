import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '@/src/modules/users/users.module';
import { AuthMiddleware } from '@/src/middleware/auth.middleware';
import { LoggerModule } from '@/src/modules/logger/logger.module';
import { FilesModule } from '@/src/modules/files/files.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CategoriesModule } from '@/src/modules/categories/categories.module';
import { CurrenciesModule } from '@/src/modules/currency/currencies.module';
import { BrandsModule } from '@/src/modules/brands/brands.module';
import { ProductsModule } from '@/src/modules/products/products.module';
import { OrdersModule } from '@/src/modules/orders/orders.module';
import { PaymentsModule } from '@/src/modules/payments/payments.module';
import { JwtModule } from '@nestjs/jwt';

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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY'),
        },
      }),
    }),
    FilesModule,
    LoggerModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CurrenciesModule,
    BrandsModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService, JwtModule],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'click/callback/prepare', method: RequestMethod.POST },
        { path: 'click/callback/complete', method: RequestMethod.POST },
        { path: 'auth/(.*)', method: RequestMethod.ALL },
        { path: 'open/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
