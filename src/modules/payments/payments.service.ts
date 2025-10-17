import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import {
  Prisma,
  Payment,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';
import { PaymentProviderFactory } from './payment-provider.factory';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
  ) {
    this.logger.setContext(PaymentsService.name);
  }

  private readonly defaultSelect = {
    id: true,
    order: {
      select: {
        id: true,
        total: true,
        status: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    },
    amount: true,
    method: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  };

  async create(dto: CreatePaymentDto) {
    this.logger.debug(
      `Creating payment for order ${dto.orderId} with method ${dto.method}`,
    );

    // Order mavjudligini tekshirish
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { user: true, payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment) {
      throw new BadRequestException('Payment already exists for this order');
    }

    if (dto.method === PaymentMethod.PAYME) {
      const provider = this.paymentProviderFactory.getProvider(dto.method);
      const paymentResponse = provider?.createPayment(dto.orderId, dto.amount);

      if (!paymentResponse?.success) {
        throw new BadRequestException(
          `Payment creation failed: ${paymentResponse?.error}`,
        );
      }

      return this.prisma.$transaction(async (tx) => {
        // Payment yaratish
        const payment = await tx.payment.create({
          data: {
            orderId: dto.orderId,
            amount: dto.amount,
            method: dto.method,
            status: PaymentStatus.PENDING,
          },
          select: this.defaultSelect,
        });

        // Transaction log yaratish
        await tx.transaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            paymentId: payment.id,
            type: TransactionType.PAYMENT,
            status: TransactionStatus.PENDING,
            amount: dto.amount,
            description: `Payment initiated via ${dto.method}`,
            metadata: {
              paymentUrl: paymentResponse.paymentUrl,
              externalTransactionId: paymentResponse.transactionId,
            },
          },
        });

        return {
          ...payment,
          paymentUrl: paymentResponse.paymentUrl,
        };
      });
    }

    // Offline to'lov usullari uchun (CARD, CASH)
    else {
      return this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            orderId: dto.orderId,
            amount: dto.amount,
            method: dto.method,
            status:
              dto.method === PaymentMethod.CASH
                ? PaymentStatus.PENDING
                : PaymentStatus.SUCCESS,
          },
          select: this.defaultSelect,
        });

        await tx.transaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            paymentId: payment.id,
            type: TransactionType.PAYMENT,
            status:
              dto.method === PaymentMethod.CASH
                ? TransactionStatus.PENDING
                : TransactionStatus.SUCCESS,
            amount: dto.amount,
            description: `Payment completed via ${dto.method}`,
          },
        });

        // Agar CARD orqali to'lov bo'lsa, orderning statusini yangilash
        if (dto.method === PaymentMethod.CARD) {
          await tx.order.update({
            where: { id: dto.orderId },
            data: { status: 'PAID' },
          });
        }

        return payment;
      });
    }
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all payments with pagination');

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            order: {
              user: {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { phoneNumber: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };

    return paginate<
      Payment,
      Prisma.PaymentWhereInput,
      Prisma.PaymentOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.payment,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      select: this.defaultSelect,
    });

    if (!payment) {
      throw new NotFoundException(`Payment with id ${id} not found`);
    }

    return payment;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    this.logger.debug(`Updating payment with id: ${id}`);

    const existing = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: { order: true },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id },
        data: { status: dto.status ?? existing.status },
        select: this.defaultSelect,
      });

      // Agar to'lov muvaffaqiyatli bo'lsa, orderning statusini yangilash
      if (
        dto.status === PaymentStatus.SUCCESS &&
        existing.status !== PaymentStatus.SUCCESS
      ) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: 'PAID' },
        });

        await tx.transaction.updateMany({
          where: { paymentId: id, type: TransactionType.PAYMENT },
          data: { status: TransactionStatus.SUCCESS },
        });
      }

      return payment;
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Soft deleting payment with id: ${id}`);

    const existing = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: { order: true },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: PaymentStatus.CANCELLED,
        },
      });

      await tx.transaction.create({
        data: {
          userId: existing.order.userId,
          paymentId: id,
          orderId: existing.orderId,
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          amount: existing.amount,
          description: 'Payment cancelled (refunded)',
        },
      });
    });
  }
}
