import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService, LoggerService],
})
export class ProductsModule {}
