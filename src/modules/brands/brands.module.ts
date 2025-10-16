import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';

@Module({
  controllers: [BrandsController],
  providers: [BrandsService, PrismaService, LoggerService],
})
export class BrandsModule {}
