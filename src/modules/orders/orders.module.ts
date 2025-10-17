import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, LoggerService],
})
export class OrdersModule {}
