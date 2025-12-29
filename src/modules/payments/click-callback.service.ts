import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/src/prisma.service';
import {
  PaymentStatus,
  OrderStatus,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '@prisma/client';
import * as crypto from 'crypto';

interface ClickPrepareRequest {
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

interface ClickCompleteRequest {
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  merchant_prepare_id: number;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

@Injectable()
export class ClickCallbackService {
  private readonly logger = new Logger(ClickCallbackService.name);
  private readonly secretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.secretKey = this.configService.get<string>('CLICK_SECRET_KEY') || '';
  }

  /**
   * Verify Click signature
   */
  private verifySignature(
    clickTransId: number,
    serviceId: number,
    merchantTransId: string,
    amount: number,
    action: number,
    signTime: string,
    signString: string,
  ): boolean {
    const data = `${clickTransId}${serviceId}${this.secretKey}${merchantTransId}${amount}${action}${signTime}`;
    const hash = crypto.createHash('md5').update(data).digest('hex');

    return hash === signString;
  }

  /**
   * PREPARE - Validate order before payment
   */
  async handlePrepare(dto: ClickPrepareRequest) {
    this.logger.log(`Processing PREPARE for order: ${dto.merchant_trans_id}`);

    // Verify signature
    const isValidSignature = this.verifySignature(
      dto.click_trans_id,
      dto.service_id,
      dto.merchant_trans_id,
      dto.amount,
      dto.action,
      dto.sign_time,
      dto.sign_string,
    );

    if (!isValidSignature) {
      this.logger.error('Invalid signature');
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: 0,
        error: -1,
        error_note: 'Invalid signature',
      };
    }

    // Find order
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.merchant_trans_id,
        deletedAt: null,
      },
      include: {
        payment: true,
      },
    });

    // Order not found
    if (!order) {
      this.logger.error(`Order not found: ${dto.merchant_trans_id}`);
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: 0,
        error: -5,
        error_note: 'Order not found',
      };
    }

    // Check order status
    if (order.status !== OrderStatus.PENDING) {
      this.logger.error(`Order status is not PENDING: ${order.status}`);
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: 0,
        error: -4,
        error_note: `Order already ${order.status}`,
      };
    }

    // Check amount
    if (Math.abs(order.total - dto.amount) > 0.01) {
      this.logger.error(
        `Amount mismatch. Expected: ${order.total}, Got: ${dto.amount}`,
      );
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: 0,
        error: -2,
        error_note: 'Incorrect amount',
      };
    }

    // Check if payment already exists
    if (order.payment && order.payment.status === PaymentStatus.SUCCESS) {
      this.logger.error('Payment already completed');
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: parseInt(order.payment.id),
        error: -4,
        error_note: 'Payment already completed',
      };
    }

    // Create or update payment
    const payment = await this.prisma.payment.upsert({
      where: {
        orderId: order.id,
      },
      update: {
        status: PaymentStatus.PENDING,
        externalTransactionId: dto.click_trans_id.toString(),
      },
      create: {
        orderId: order.id,
        amount: dto.amount,
        method: PaymentMethod.CLICK,
        status: PaymentStatus.PENDING,
        externalTransactionId: dto.click_trans_id.toString(),
      },
    });

    // Create transaction log
    await this.prisma.transaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        paymentId: payment.id,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
        amount: dto.amount,
        description: 'Click PREPARE request received',
        metadata: {
          click_trans_id: dto.click_trans_id,
          click_paydoc_id: dto.click_paydoc_id,
          action: dto.action,
          sign_time: dto.sign_time,
        },
      },
    });

    // Success response
    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_prepare_id: parseInt(
        payment.id.replace(/-/g, '').substring(0, 10),
        16,
      ),
      error: 0,
      error_note: 'Success',
    };
  }

  /**
   * COMPLETE - Finalize payment
   */
  async handleComplete(dto: ClickCompleteRequest) {
    this.logger.log(`Processing COMPLETE for order: ${dto.merchant_trans_id}`);

    // Verify signature
    const isValidSignature = this.verifySignature(
      dto.click_trans_id,
      dto.service_id,
      dto.merchant_trans_id,
      dto.amount,
      dto.action,
      dto.sign_time,
      dto.sign_string,
    );

    if (!isValidSignature) {
      this.logger.error('Invalid signature');
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: -1,
        error_note: 'Invalid signature',
      };
    }

    // Find order
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.merchant_trans_id,
        deletedAt: null,
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: -5,
        error_note: 'Order not found',
      };
    }

    if (!order.payment) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: -6,
        error_note: 'Payment not found',
      };
    }

    // Check if already completed
    if (order.payment.status === PaymentStatus.SUCCESS) {
      this.logger.log('Payment already completed');
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: parseInt(
          order.payment.id.replace(/-/g, '').substring(0, 10),
          16,
        ),
        error: 0,
        error_note: 'Already paid',
      };
    }

    // Check if action is COMPLETE (action = 1)
    if (dto.action !== 1) {
      this.logger.error(`Invalid action: ${dto.action}`);
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: -3,
        error_note: 'Invalid action',
      };
    }

    // Check if error from Click
    if (dto.error < 0) {
      this.logger.error(`Click error: ${dto.error} - ${dto.error_note}`);

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: order.payment!.id },
          data: { status: PaymentStatus.FAILED },
        });

        await tx.transaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            paymentId: order.payment!.id,
            type: TransactionType.PAYMENT,
            status: TransactionStatus.FAILED,
            amount: dto.amount,
            description: `Click COMPLETE failed: ${dto.error_note}`,
            metadata: {
              click_trans_id: dto.click_trans_id,
              error: dto.error,
              error_note: dto.error_note,
            },
          },
        });
      });

      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: dto.error,
        error_note: dto.error_note,
      };
    }

    // Complete payment successfully
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: order.payment!.id },
        data: { status: PaymentStatus.SUCCESS },
      });

      // Update order status
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });

      // Create transaction log
      await tx.transaction.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          paymentId: order.payment!.id,
          type: TransactionType.PAYMENT,
          status: TransactionStatus.SUCCESS,
          amount: dto.amount,
          description: 'Click payment completed successfully',
          metadata: {
            click_trans_id: dto.click_trans_id,
            click_paydoc_id: dto.click_paydoc_id,
            merchant_prepare_id: dto.merchant_prepare_id,
          },
        },
      });
    });

    this.logger.log(`Payment completed successfully for order: ${order.id}`);

    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_confirm_id: parseInt(
        order.payment.id.replace(/-/g, '').substring(0, 10),
        16,
      ),
      error: 0,
      error_note: 'Success',
    };
  }
}
