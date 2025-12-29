import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  IPaymentProvider,
  PaymentCreateResponse,
  PaymentStatusResponse,
} from '../interfaces/payment-provider.interface';

interface ClickConfig {
  merchantId: string;
  serviceId: string;
  merchantUserId: string;
  secretKey: string;
  apiUrl: string;
}

interface ClickInvoiceResponse {
  error_code: number;
  error_note: string;
  invoice_id?: number;
}

interface ClickPaymentStatusResponse {
  error_code: number;
  error_note: string;
  payment_id?: number;
  payment_status?: number;
}

interface ClickInvoiceStatusResponse {
  error_code: number;
  error_note: string;
  invoice_status?: number;
  invoice_status_note?: string;
}

interface ClickCardTokenResponse {
  error_code: number;
  error_note: string;
  card_token?: string;
  phone_number?: string;
  temporary?: number;
}

interface ClickCardTokenVerifyResponse {
  error_code: number;
  error_note: string;
  card_number?: string;
}

interface ClickTokenPaymentResponse {
  error_code: number;
  error_note: string;
  payment_id?: number;
  payment_status?: number;
}

interface ClickPaymentByMerchantTransIdResponse {
  error_code: number;
  error_note: string;
  payment_id?: number;
  payment_status?: number;
}

interface ClickReversalResponse {
  error_code: number;
  error_note: string;
  payment_id?: number;
}

interface ClickCardTokenDeleteResponse {
  error_code: number;
  error_note: string;
}

@Injectable()
export class ClickProvider implements IPaymentProvider {
  private readonly logger = new Logger(ClickProvider.name);
  private readonly config: ClickConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      merchantId: this.configService.get<string>('CLICK_MERCHANT_ID') || '',
      serviceId: this.configService.get<string>('CLICK_SERVICE_ID') || '',
      merchantUserId:
        this.configService.get<string>('CLICK_MERCHANT_USER_ID') || '',
      secretKey: this.configService.get<string>('CLICK_SECRET_KEY') || '',
      apiUrl:
        this.configService.get<string>('CLICK_API_URL') ||
        'https://api.click.uz/v2/merchant',
    };
  }

  /**
   * Generate authentication header
   */
  private generateAuthHeader(): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = crypto
      .createHash('sha1')
      .update(`${timestamp}${this.config.secretKey}`)
      .digest('hex');

    return `${this.config.merchantUserId}:${digest}:${timestamp}`;
  }

  /**
   * Make HTTP request to Click API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body?: Record<string, any>,
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Auth: this.generateAuthHeader(),
    };

    this.logger.debug(`Making ${method} request to ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as T;

      const errorData = data as { error_code?: number; error_note?: string };
      if (errorData.error_code && errorData.error_code !== 0) {
        this.logger.error(
          `Click API error: ${errorData.error_note} (code: ${errorData.error_code})`,
        );
      }

      return data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Request failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create invoice for payment
   */
  async createInvoice(
    orderId: string,
    amount: number,
    phoneNumber: string,
  ): Promise<{ success: boolean; invoiceId?: number; error?: string }> {
    try {
      const response = await this.makeRequest<ClickInvoiceResponse>(
        'POST',
        '/invoice/create',
        {
          service_id: parseInt(this.config.serviceId),
          amount: amount,
          phone_number: phoneNumber,
          merchant_trans_id: orderId,
        },
      );

      if (response.error_code === 0 && response.invoice_id) {
        return {
          success: true,
          invoiceId: response.invoice_id,
        };
      }

      return {
        success: false,
        error: response.error_note || 'Failed to create invoice',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Create invoice failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check invoice status
   */
  async checkInvoiceStatus(invoiceId: number): Promise<{
    success: boolean;
    status?: number;
    statusNote?: string;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<ClickInvoiceStatusResponse>(
        'GET',
        `/invoice/status/${this.config.serviceId}/${invoiceId}`,
      );

      if (response.error_code === 0) {
        return {
          success: true,
          status: response.invoice_status,
          statusNote: response.invoice_status_note,
        };
      }

      return {
        success: false,
        error: response.error_note,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create payment (implementation for IPaymentProvider)
   */
  createPayment(orderId: string): PaymentCreateResponse {
    // Click uses invoice-based payment, return placeholder
    // Actual invoice creation happens in createInvoice method with phone number
    return {
      success: true,
      paymentUrl: `${this.config.apiUrl}/invoice/create`,
      transactionId: orderId,
    };
  }

  /**
   * Check payment status
   */
  async checkPayment(paymentId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await this.makeRequest<ClickPaymentStatusResponse>(
        'GET',
        `/payment/status/${this.config.serviceId}/${paymentId}`,
      );

      if (response.error_code === 0) {
        let status: 'pending' | 'success' | 'failed' | 'cancelled';

        switch (response.payment_status) {
          case 1:
            status = 'success';
            break;
          case -1:
            status = 'failed';
            break;
          case -2:
            status = 'cancelled';
            break;
          default:
            status = 'pending';
        }

        return {
          status,
          transactionId: paymentId,
          amount: 0, // Amount should be retrieved from database
        };
      }

      return {
        status: 'failed',
        transactionId: paymentId,
        amount: 0,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Check payment failed: ${errorMessage}`);
      return {
        status: 'failed',
        transactionId: paymentId,
        amount: 0,
      };
    }
  }

  /**
   * Check payment by merchant transaction ID
   */
  async checkPaymentByMerchantTransId(
    merchantTransId: string,
    date: string,
  ): Promise<{
    success: boolean;
    paymentId?: number;
    paymentStatus?: number;
    error?: string;
  }> {
    try {
      const response =
        await this.makeRequest<ClickPaymentByMerchantTransIdResponse>(
          'GET',
          `/payment/status_by_mti/${this.config.serviceId}/${merchantTransId}/${date}`,
        );

      if (response.error_code === 0) {
        return {
          success: true,
          paymentId: response.payment_id,
          paymentStatus: response.payment_status,
        };
      }

      return {
        success: false,
        error: response.error_note,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel payment (reversal)
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<ClickReversalResponse>(
        'DELETE',
        `/payment/reversal/${this.config.serviceId}/${paymentId}`,
      );

      if (response.error_code === 0) {
        this.logger.log(`Payment ${paymentId} cancelled successfully`);
        return true;
      }

      this.logger.error(`Failed to cancel payment: ${response.error_note}`);
      return false;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cancel payment failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Request card token
   */
  async requestCardToken(
    cardNumber: string,
    expireDate: string,
    temporary: boolean = false,
  ): Promise<{
    success: boolean;
    cardToken?: string;
    phoneNumber?: string;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<ClickCardTokenResponse>(
        'POST',
        '/card_token/request',
        {
          service_id: parseInt(this.config.serviceId),
          card_number: cardNumber,
          expire_date: expireDate,
          temporary: temporary ? 1 : 0,
        },
      );

      if (response.error_code === 0 && response.card_token) {
        return {
          success: true,
          cardToken: response.card_token,
          phoneNumber: response.phone_number,
        };
      }

      return {
        success: false,
        error: response.error_note || 'Failed to create card token',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Request card token failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify card token with SMS code
   */
  async verifyCardToken(
    cardToken: string,
    smsCode: string,
  ): Promise<{
    success: boolean;
    cardNumber?: string;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<ClickCardTokenVerifyResponse>(
        'POST',
        '/card_token/verify',
        {
          service_id: parseInt(this.config.serviceId),
          card_token: cardToken,
          sms_code: parseInt(smsCode),
        },
      );

      if (response.error_code === 0) {
        return {
          success: true,
          cardNumber: response.card_number,
        };
      }

      return {
        success: false,
        error: response.error_note,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Make payment with card token
   */
  async paymentWithToken(
    cardToken: string,
    amount: number,
    merchantTransId: string,
  ): Promise<{
    success: boolean;
    paymentId?: number;
    paymentStatus?: number;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<ClickTokenPaymentResponse>(
        'POST',
        '/card_token/payment',
        {
          service_id: parseInt(this.config.serviceId),
          card_token: cardToken,
          amount: amount,
          transaction_parameter: merchantTransId,
        },
      );

      if (response.error_code === 0) {
        return {
          success: true,
          paymentId: response.payment_id,
          paymentStatus: response.payment_status,
        };
      }

      return {
        success: false,
        error: response.error_note || 'Payment with token failed',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Payment with token failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete card token
   */
  async deleteCardToken(cardToken: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<ClickCardTokenDeleteResponse>(
        'DELETE',
        `/card_token/${this.config.serviceId}/${cardToken}`,
      );

      return response.error_code === 0;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Delete card token failed: ${errorMessage}`);
      return false;
    }
  }
}
