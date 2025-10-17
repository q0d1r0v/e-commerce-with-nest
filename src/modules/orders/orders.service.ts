import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import {
  Prisma,
  Order,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  private readonly defaultSelect = {
    id: true,
    total: true,
    status: true,
    user: {
      select: { id: true, fullName: true, phoneNumber: true },
    },
    items: {
      select: {
        product: { select: { id: true, name: true } },
        quantity: true,
        price: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  };

  async create(dto: CreateOrderDto) {
    this.logger.debug(`Creating order for user ${dto.userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!dto.items.length)
      throw new BadRequestException('Order must contain items');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: dto.userId,
          total: dto.total,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        select: this.defaultSelect,
      });

      await tx.transaction.create({
        data: {
          userId: dto.userId,
          orderId: order.id,
          type: TransactionType.PAYMENT,
          status: TransactionStatus.PENDING,
          amount: dto.total,
          description: 'Order created, awaiting payment',
        },
      });

      return order;
    });
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all orders with pagination');

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            user: {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    return paginate<
      Order,
      Prisma.OrderWhereInput,
      Prisma.OrderOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.order,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      select: this.defaultSelect,
    });
    if (!order) throw new NotFoundException(`Order with id ${id} not found`);
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    this.logger.debug(`Updating order with id: ${id}`);

    const existing = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Order not found');

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status ?? existing.status },
      select: this.defaultSelect,
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Soft deleting order with id: ${id}`);

    const existing = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Order not found');

    await this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.transaction.create({
      data: {
        orderId: id,
        userId: existing.userId,
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCESS,
        amount: existing.total,
        description: 'Order cancelled and refunded',
      },
    });
  }
}
