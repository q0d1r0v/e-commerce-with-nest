import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { Prisma, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ProductsService.name);
  }

  private readonly defaultSelect = {
    id: true,
    name: true,
    description: true,
    price: true,
    discountPrice: true,
    stock: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    categoryId: true,
    brandId: true,
    category: { select: { id: true, name: true } },
    brand: { select: { id: true, name: true } },
    productImages: {
      select: {
        id: true,
        isMain: true,
        sortOrder: true,
        file: { select: { id: true, path: true, name: true } },
      },
    },
  };

  async create(dto: CreateProductDto) {
    this.logger.debug(`Creating product: ${dto.name}`);

    const duplicate = await this.prisma.product.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (duplicate) {
      throw new BadRequestException(`Product "${dto.name}" already exists`);
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException(
        `Category with id "${dto.categoryId}" not found`,
      );
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) {
        throw new BadRequestException(
          `Brand with id "${dto.brandId}" not found`,
        );
      }
    }

    if (dto.images?.length) {
      const fileIds = dto.images.map((img) => img.fileId);

      const existingFiles = await this.prisma.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true },
      });

      const missingIds = fileIds.filter(
        (id) => !existingFiles.some((f) => f.id === id),
      );

      if (missingIds.length > 0) {
        throw new BadRequestException(
          `Some image files not found: ${missingIds.join(', ')}`,
        );
      }
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        discountPrice: dto.discountPrice ?? null,
        stock: dto.stock ?? 0,
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        isActive: dto.isActive ?? true,
        productImages: dto.images
          ? {
              create: dto.images.map((img) => ({
                fileId: img.fileId,
                isMain: img.isMain ?? false,
                sortOrder: img.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      select: this.defaultSelect,
    });
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all products with pagination');

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return paginate<
      Product,
      Prisma.ProductWhereInput,
      Prisma.ProductOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.product,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    this.logger.debug(`Fetching product by id: ${id}`);

    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
      select: this.defaultSelect,
    });

    if (!product)
      throw new NotFoundException(`Product with id ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    this.logger.debug(`Updating product with id: ${id}`);

    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Product with id ${id} not found`);

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.product.findFirst({
        where: { name: dto.name },
      });
      if (duplicate)
        throw new BadRequestException(`Product "${dto.name}" already exists`);
    }

    if (dto.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!categoryExists)
        throw new BadRequestException(
          `Category with id ${dto.categoryId} not found`,
        );
    }

    if (dto.brandId) {
      const brandExists = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brandExists)
        throw new BadRequestException(`Brand with id ${dto.brandId} not found`);
    }

    if (dto.images?.length) {
      for (const img of dto.images) {
        const fileExists = await this.prisma.file.findUnique({
          where: { id: img.fileId },
        });
        if (!fileExists)
          throw new BadRequestException(
            `File with id ${img.fileId} not found (in images)`,
          );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        price: dto.price ?? existing.price,
        discountPrice:
          dto.discountPrice !== undefined && dto.discountPrice !== null
            ? new Prisma.Decimal(dto.discountPrice)
            : new Prisma.Decimal(existing.discountPrice ?? 0),
        stock: dto.stock ?? existing.stock,
        categoryId: dto.categoryId ?? existing.categoryId,
        brandId: dto.brandId ?? existing.brandId,
        isActive: dto.isActive ?? existing.isActive,
        productImages: dto.images
          ? {
              deleteMany: {},
              create: dto.images.map((img) => ({
                fileId: img.fileId,
                isMain: img.isMain ?? false,
                sortOrder: img.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      select: this.defaultSelect,
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Soft deleting product with id: ${id}`);

    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Product with id ${id} not found`);

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
  async restore(id: string): Promise<Product> {
    this.logger.debug(`Restoring product with id: ${id}`);

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    if (!product.deletedAt) {
      throw new BadRequestException(`Product with id ${id} is not deleted`);
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: null },
      select: this.defaultSelect,
    });
  }

  async changeActiveStatus(id: string, isActive: boolean): Promise<Product> {
    this.logger.debug(
      `Changing active status of product ${id} to ${isActive ? 'active' : 'inactive'}`,
    );

    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    if (product.deletedAt) {
      throw new BadRequestException(`Cannot change status of deleted product`);
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive },
      select: this.defaultSelect,
    });
  }
}
