import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { PaymeProvider } from './providers/payme.provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(private readonly paymeProvider: PaymeProvider) {}

  getProvider(method: PaymentMethod): IPaymentProvider | null {
    switch (method) {
      case PaymentMethod.PAYME:
        return this.paymeProvider;
      case PaymentMethod.CASH:
        return null;
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }
}
