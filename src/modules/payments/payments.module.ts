import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ClickPaymentController } from './click-payment.controller';
import { ClickPaymentService } from './click-payment.service';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderFactory } from './payment-provider.factory';
import { ClickProvider } from './providers/click.provider';

@Module({
  controllers: [PaymentsController, ClickPaymentController],
  providers: [
    PaymentsService,
    ClickPaymentService,
    PrismaService,
    LoggerService,
    ConfigService,
    ClickProvider,
    PaymentProviderFactory,
  ],
  exports: [PaymentsService, ClickPaymentService],
})
export class PaymentsModule {}
