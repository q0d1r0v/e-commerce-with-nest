import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, PrismaService, LoggerService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
