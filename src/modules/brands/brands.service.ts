import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { Prisma, Brand } from '@prisma/client';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BrandsService.name);
  }

  private readonly defaultSelect = {
    id: true,
    name: true,
    description: true,
    logo: {
      select: { id: true, path: true, name: true },
    },
    isActive: true,
    createdAt: true,
    updatedAt: true,
  };

  async create(dto: CreateBrandDto) {
    this.logger.debug(`Creating brand: ${dto.name}`);

    const existing = await this.prisma.brand.findUnique({
      where: { name: dto.name },
    });
    if (existing)
      throw new BadRequestException(`Brand "${dto.name}" already exists`);

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        description: dto.description,
        logoId: dto.logoId ?? null,
        isActive: dto.isActive ?? true,
      },
      select: this.defaultSelect,
    });
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all brands with pagination');

    const where: Prisma.BrandWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return paginate<
      Brand,
      Prisma.BrandWhereInput,
      Prisma.BrandOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.brand,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: this.defaultSelect,
    });
    if (!brand) throw new NotFoundException(`Brand with id ${id} not found`);
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto) {
    this.logger.debug(`Updating brand with id: ${id}`);

    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Brand with id ${id} not found`);

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.brand.findUnique({
        where: { name: dto.name },
      });
      if (duplicate)
        throw new BadRequestException(`Brand "${dto.name}" already exists`);
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        logoId: dto.logoId ?? existing.logoId,
        isActive: dto.isActive ?? existing.isActive,
      },
      select: this.defaultSelect,
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting brand with id: ${id}`);

    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Brand with id ${id} not found`);

    await this.prisma.brand.delete({ where: { id } });
  }
}
