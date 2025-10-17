import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentProvider,
  PaymentCreateResponse,
  PaymentStatusResponse,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class PaymeProvider implements IPaymentProvider {
  private readonly logger = new Logger(PaymeProvider.name);
  private readonly merchantId: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('PAYME_MERCHANT_ID') ?? '';
    this.callbackUrl =
      this.configService.get<string>('PAYME_CALLBACK_URL') ?? '';
  }

  createPayment(orderId: string, amount: number): PaymentCreateResponse {
    try {
      this.logger.debug(
        `Creating Payme payment for order ${orderId}, amount: ${amount}`,
      );

      // Payme uchun amount tiyin (som * 100) da bo'lishi kerak
      const amountInTiyin = Math.round(amount * 100);

      // Payme checkout parametrlarini yaratish
      const params = Buffer.from(
        JSON.stringify({
          merchant_id: this.merchantId,
          amount: amountInTiyin,
          account: {
            order_id: orderId,
          },
          return_url: this.callbackUrl,
        }),
      ).toString('base64');

      const paymentUrl = `https://checkout.paycom.uz/${params}`;

      this.logger.debug(`Payme payment URL created: ${paymentUrl}`);

      return {
        success: true,
        paymentUrl,
        transactionId: orderId,
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      this.logger.error(`Payme payment creation failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  checkPayment(transactionId: string): PaymentStatusResponse {
    // Bu method Payme webhook orqali status yangilanadi
    // Shuning uchun bu yerda faqat pending qaytaramiz
    this.logger.debug(`Checking Payme payment status: ${transactionId}`);

    return {
      status: 'pending',
      transactionId,
      amount: 0,
    };
  }

  cancelPayment(transactionId: string): boolean {
    this.logger.debug(`Payme payment cancellation requested: ${transactionId}`);
    // Payme webhook orqali bekor qilinadi
    return true;
  }
}
