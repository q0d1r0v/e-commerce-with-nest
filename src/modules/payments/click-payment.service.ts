import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { ClickProvider } from './providers/click.provider';
import {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
  OrderStatus,
  PaymentMethod,
} from '@prisma/client';
import {
  CreateClickInvoiceDto,
  RequestCardTokenDto,
  VerifyCardTokenDto,
  PaymentWithTokenDto,
} from './dto/click-payment.dto';

@Injectable()
export class ClickPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly clickProvider: ClickProvider,
  ) {
    this.logger.setContext(ClickPaymentService.name);
  }

  /**
   * Create Click invoice for payment
   */
  async createInvoice(userId: string, dto: CreateClickInvoiceDto) {
    this.logger.debug(`Creating Click invoice for order ${dto.orderId}`);

    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId: userId,
        deletedAt: null,
      },
      include: {
        payment: true,
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment) {
      throw new BadRequestException('Payment already exists for this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order status is ${order.status}, cannot create invoice`,
      );
    }

    const invoiceResult = await this.clickProvider.createInvoice(
      dto.orderId,
      dto.amount,
      dto.phoneNumber,
    );

    if (!invoiceResult.success) {
      throw new BadRequestException(
        invoiceResult.error || 'Failed to create Click invoice',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          amount: dto.amount,
          method: PaymentMethod.CLICK,
          status: PaymentStatus.PENDING,
          externalTransactionId: invoiceResult.invoiceId?.toString(),
        },
      });

      await tx.transaction.create({
        data: {
          userId: userId,
          orderId: order.id,
          paymentId: payment.id,
          type: TransactionType.PAYMENT,
          status: TransactionStatus.PENDING,
          amount: dto.amount,
          description: 'Click invoice created',
          metadata: {
            invoiceId: invoiceResult.invoiceId,
            phoneNumber: dto.phoneNumber,
          },
        },
      });

      return {
        success: true,
        payment,
        invoiceId: invoiceResult.invoiceId,
        message: 'Invoice created. User will receive SMS to complete payment.',
      };
    });
  }

  /**
   * Check invoice status
   */
  async checkInvoiceStatus(invoiceId: number) {
    this.logger.debug(`Checking Click invoice status: ${invoiceId}`);

    const statusResult = await this.clickProvider.checkInvoiceStatus(invoiceId);

    if (!statusResult.success) {
      throw new BadRequestException(
        statusResult.error || 'Failed to check invoice status',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        externalTransactionId: invoiceId.toString(),
        method: PaymentMethod.CLICK,
      },
      include: {
        order: true,
      },
    });

    if (payment) {
      if (statusResult.status === 1) {
        await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.SUCCESS,
          payment.order.id,
        );
      } else if (statusResult.status === -99) {
        await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.CANCELLED,
          payment.order.id,
        );
      }
    }

    return {
      success: true,
      invoiceId,
      status: statusResult.status,
      statusNote: statusResult.statusNote,
      payment: payment || null,
    };
  }

  /**
   * Request card token
   */
  async requestCardToken(userId: string, dto: RequestCardTokenDto) {
    this.logger.debug(`Requesting card token for user ${userId}`);

    const tokenResult = await this.clickProvider.requestCardToken(
      dto.cardNumber,
      dto.expireDate,
      dto.temporary || false,
    );

    if (!tokenResult.success) {
      throw new BadRequestException(
        tokenResult.error || 'Failed to request card token',
      );
    }

    if (!tokenResult.cardToken) {
      throw new BadRequestException('Card token not received from Click');
    }

    // Save temporary card info (will be updated after verification)
    await this.prisma.userCard.create({
      data: {
        userId: userId,
        cardToken: tokenResult.cardToken,
        cardNumber: '', // Will be updated after verification
        cardNumberMasked: `****${dto.cardNumber.slice(-4)}`,
        phoneNumber: tokenResult.phoneNumber || null,
        isTemporary: dto.temporary || false,
        isActive: false, // Not active until verified
      },
    });

    return {
      success: true,
      cardToken: tokenResult.cardToken,
      phoneNumber: tokenResult.phoneNumber,
      message: 'SMS verification code sent to your phone',
    };
  }

  /**
   * Verify card token with SMS code
   */
  async verifyCardToken(userId: string, dto: VerifyCardTokenDto) {
    this.logger.debug(`Verifying card token for user ${userId}`);

    const verifyResult = await this.clickProvider.verifyCardToken(
      dto.cardToken,
      dto.smsCode,
    );

    if (!verifyResult.success) {
      throw new BadRequestException(
        verifyResult.error || 'Failed to verify card token',
      );
    }

    if (!verifyResult.cardNumber) {
      throw new BadRequestException('Card number not received from Click');
    }

    // Update card with full info and activate
    const card = await this.prisma.userCard.findFirst({
      where: {
        userId: userId,
        cardToken: dto.cardToken,
        deletedAt: null,
      },
    });

    if (!card) {
      throw new NotFoundException('Card token not found');
    }

    await this.prisma.userCard.update({
      where: { id: card.id },
      data: {
        cardNumber: verifyResult.cardNumber,
        isActive: true,
      },
    });

    return {
      success: true,
      cardToken: dto.cardToken,
      cardNumber: verifyResult.cardNumber,
      message: 'Card verified and saved successfully',
    };
  }

  /**
   * Make payment with card token
   */
  async paymentWithToken(userId: string, dto: PaymentWithTokenDto) {
    this.logger.debug(`Processing payment with token for order ${dto.orderId}`);

    // Verify order
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId: userId,
        deletedAt: null,
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment) {
      throw new BadRequestException('Payment already exists for this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order status is ${order.status}, cannot process payment`,
      );
    }

    // Verify card token exists, is verified, and belongs to user
    const userCard = await this.prisma.userCard.findFirst({
      where: {
        userId: userId,
        cardToken: dto.cardToken,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!userCard) {
      throw new BadRequestException('Card token not found or not verified');
    }

    // Process payment via Click API
    const paymentResult = await this.clickProvider.paymentWithToken(
      dto.cardToken,
      dto.amount,
      dto.orderId,
    );

    if (!paymentResult.success) {
      throw new BadRequestException(paymentResult.error || 'Payment failed');
    }

    // Create payment record and update order
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          amount: dto.amount,
          method: PaymentMethod.CLICK,
          status:
            paymentResult.paymentStatus === 1
              ? PaymentStatus.SUCCESS
              : PaymentStatus.PENDING,
          externalTransactionId: paymentResult.paymentId?.toString(),
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      // Create transaction log
      await tx.transaction.create({
        data: {
          userId: userId,
          orderId: order.id,
          paymentId: payment.id,
          type: TransactionType.PAYMENT,
          status:
            paymentResult.paymentStatus === 1
              ? TransactionStatus.SUCCESS
              : TransactionStatus.PENDING,
          amount: dto.amount,
          description: 'Payment via Click card token',
          metadata: {
            paymentId: paymentResult.paymentId,
            cardToken: dto.cardToken,
            cardNumber: userCard.cardNumber,
            cardNumberMasked: userCard.cardNumberMasked,
          },
        },
      });

      // Update card last used time
      await tx.userCard.update({
        where: { id: userCard.id },
        data: { lastUsedAt: new Date() },
      });

      // Update order status if payment successful
      if (paymentResult.paymentStatus === 1) {
        await tx.order.update({
          where: { id: dto.orderId },
          data: { status: OrderStatus.PAID },
        });
      }

      return {
        success: true,
        payment,
        message:
          paymentResult.paymentStatus === 1
            ? 'Payment successful'
            : 'Payment processing',
      };
    });
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string) {
    this.logger.debug(`Checking Click payment status: ${paymentId}`);

    const statusResult = await this.clickProvider.checkPayment(paymentId);

    const payment = await this.prisma.payment.findFirst({
      where: {
        externalTransactionId: paymentId,
        method: PaymentMethod.CLICK,
      },
      include: {
        order: true,
      },
    });

    if (payment) {
      if (
        statusResult.status === 'success' &&
        payment.status !== PaymentStatus.SUCCESS
      ) {
        await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.SUCCESS,
          payment.order.id,
        );
      } else if (
        statusResult.status === 'failed' &&
        payment.status !== PaymentStatus.FAILED
      ) {
        await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.FAILED,
          payment.order.id,
        );
      } else if (
        statusResult.status === 'cancelled' &&
        payment.status !== PaymentStatus.CANCELLED
      ) {
        await this.updatePaymentStatus(
          payment.id,
          PaymentStatus.CANCELLED,
          payment.order.id,
        );
      }
    }

    return {
      success: true,
      paymentId,
      status: statusResult.status,
      payment: payment || null,
    };
  }

  /**
   * Check payment by order ID
   */
  async checkPaymentByOrder(orderId: string, date: string) {
    this.logger.debug(`Checking payment for order ${orderId} on ${date}`);

    const result = await this.clickProvider.checkPaymentByMerchantTransId(
      orderId,
      date,
    );

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to check payment');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: orderId,
        method: PaymentMethod.CLICK,
      },
      include: {
        order: true,
      },
    });

    return {
      success: true,
      orderId,
      paymentId: result.paymentId,
      paymentStatus: result.paymentStatus,
      payment: payment || null,
    };
  }

  /**
   * Cancel payment (reversal)
   */
  async cancelPayment(paymentId: string) {
    this.logger.debug(`Cancelling Click payment: ${paymentId}`);

    const payment = await this.prisma.payment.findFirst({
      where: {
        externalTransactionId: paymentId,
        method: PaymentMethod.CLICK,
        deletedAt: null,
      },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Can only cancel successful payments');
    }

    const cancelResult = await this.clickProvider.cancelPayment(paymentId);

    if (!cancelResult) {
      throw new BadRequestException(
        'Failed to cancel payment. Check Click conditions.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CANCELLED,
          deletedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      await tx.transaction.create({
        data: {
          userId: payment.order.userId,
          orderId: payment.orderId,
          paymentId: payment.id,
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          amount: payment.amount,
          description: 'Payment cancelled and refunded via Click',
          metadata: {
            clickPaymentId: paymentId,
            cancelledAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        message: 'Payment cancelled successfully',
      };
    });
  }

  /**
   * Delete card token
   */
  async deleteCardToken(userId: string, cardToken: string) {
    this.logger.debug(`Deleting card token for user ${userId}`);

    const userCard = await this.prisma.userCard.findFirst({
      where: {
        userId: userId,
        cardToken: cardToken,
        deletedAt: null,
      },
    });

    if (!userCard) {
      throw new NotFoundException('Card token not found');
    }

    const deleteResult = await this.clickProvider.deleteCardToken(cardToken);

    if (!deleteResult) {
      throw new BadRequestException('Failed to delete card token');
    }

    await this.prisma.userCard.update({
      where: { id: userCard.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      success: true,
      message: 'Card deleted successfully',
    };
  }

  /**
   * Get user saved cards
   */
  async getUserSavedCards(userId: string) {
    const cards = await this.prisma.userCard.findMany({
      where: {
        userId: userId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        cardToken: true,
        cardNumber: true,
        cardNumberMasked: true,
        phoneNumber: true,
        isTemporary: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });

    return {
      success: true,
      cards: cards,
    };
  }

  /**
   * Helper: Update payment status and order status
   */
  private async updatePaymentStatus(
    paymentId: string,
    newStatus: PaymentStatus,
    orderId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: newStatus },
      });

      let orderStatus: OrderStatus;
      if (newStatus === PaymentStatus.SUCCESS) {
        orderStatus = OrderStatus.PAID;
      } else if (
        newStatus === PaymentStatus.FAILED ||
        newStatus === PaymentStatus.CANCELLED
      ) {
        orderStatus = OrderStatus.CANCELLED;
      } else {
        orderStatus = OrderStatus.PENDING;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: orderStatus },
      });

      await tx.transaction.updateMany({
        where: {
          paymentId: paymentId,
          type: TransactionType.PAYMENT,
        },
        data: {
          status:
            newStatus === PaymentStatus.SUCCESS
              ? TransactionStatus.SUCCESS
              : newStatus === PaymentStatus.FAILED
                ? TransactionStatus.FAILED
                : TransactionStatus.PENDING,
        },
      });
    });
  }
}
