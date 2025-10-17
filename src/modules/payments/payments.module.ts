import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymeProvider } from './providers/payme.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PrismaService,
    LoggerService,
    ConfigService,
    PaymeProvider,
    PaymentProviderFactory,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
