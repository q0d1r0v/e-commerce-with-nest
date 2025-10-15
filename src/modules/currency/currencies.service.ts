import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { Prisma, Currency } from '@prisma/client';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';

@Injectable()
export class CurrenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CurrenciesService.name);
  }

  private readonly defaultSelect = {
    id: true,
    code: true,
    name: true,
    symbol: true,
    isMain: true,
    rateToMain: true,
    createdAt: true,
    updatedAt: true,
  };

  async create(dto: CreateCurrencyDto) {
    this.logger.debug(`Creating currency: ${dto.code}`);

    if (dto.isMain) {
      const existingMain = await this.prisma.currency.findFirst({
        where: { isMain: true },
      });
      if (existingMain)
        throw new BadRequestException(
          `Main currency (${existingMain.code}) already exists`,
        );
    }

    const existing = await this.prisma.currency.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing)
      throw new BadRequestException(`Currency ${dto.code} already exists`);

    const currency = await this.prisma.currency.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        symbol: dto.symbol,
        isMain: dto.isMain ?? false,
        rateToMain: dto.rateToMain ?? 1,
      },
      select: this.defaultSelect,
    });

    return currency;
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all currencies with pagination');

    const where: Prisma.CurrencyWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return paginate<
      Currency,
      Prisma.CurrencyWhereInput,
      Prisma.CurrencyOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.currency,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
      select: this.defaultSelect,
    });
    if (!currency)
      throw new NotFoundException(`Currency with id ${id} not found`);
    return currency;
  }

  async update(id: string, dto: UpdateCurrencyDto) {
    this.logger.debug(`Updating currency with id: ${id}`);

    const existing = await this.prisma.currency.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Currency with id ${id} not found`);

    if (dto.isMain && !existing.isMain) {
      const mainCurrency = await this.prisma.currency.findFirst({
        where: { isMain: true },
      });
      if (mainCurrency && mainCurrency.id !== id)
        throw new BadRequestException(
          `Main currency (${mainCurrency.code}) already exists`,
        );
    }

    const updated = await this.prisma.currency.update({
      where: { id },
      data: {
        code: dto.code?.toUpperCase() ?? existing.code,
        name: dto.name ?? existing.name,
        symbol: dto.symbol ?? existing.symbol,
        isMain: dto.isMain ?? existing.isMain,
        rateToMain: dto.rateToMain ?? existing.rateToMain,
      },
      select: this.defaultSelect,
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting currency with id: ${id}`);

    const existing = await this.prisma.currency.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Currency with id ${id} not found`);

    if (existing.isMain)
      throw new BadRequestException('Cannot delete main currency');

    await this.prisma.currency.delete({ where: { id } });
  }
}
