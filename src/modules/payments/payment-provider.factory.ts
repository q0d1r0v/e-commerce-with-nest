import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { ClickProvider } from './providers/click.provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(private readonly clickProvider: ClickProvider) {}

  getProvider(method: PaymentMethod): IPaymentProvider | null {
    switch (method) {
      case PaymentMethod.CLICK:
        return this.clickProvider;
      case PaymentMethod.CASH:
      case PaymentMethod.CARD:
        return null;
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }
}
