import { Module } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';

@Module({
  controllers: [CurrenciesController],
  providers: [CurrenciesService, PrismaService, LoggerService],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
