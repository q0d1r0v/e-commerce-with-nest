import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { LoggerService } from '@/src/modules/logger/logger.service';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';
import { Prisma, Category } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CategoriesService.name);
  }

  private readonly defaultSelect = {
    id: true,
    name: true,
    parentId: true,
    parent: { select: { id: true, name: true }, where: { deletedAt: null } },
    children: { select: { id: true, name: true }, where: { deletedAt: null } },
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  };

  async create(dto: CreateCategoryDto) {
    this.logger.debug(`Creating category: ${dto.name}`);

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
      },
      select: this.defaultSelect,
    });

    return category;
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all categories with pagination');

    const where: Prisma.CategoryWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' }, deletedAt: null }
      : { deletedAt: null };

    return paginate<
      Category,
      Prisma.CategoryWhereInput,
      Prisma.CategoryOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.category,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id, deletedAt: null },
      select: this.defaultSelect,
    });
    if (!category)
      throw new NotFoundException(`Category with id ${id} not found`);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    this.logger.debug(`Updating category with id: ${id}`);

    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Category with id ${id} not found`);

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
      },
      select: this.defaultSelect,
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Soft deleting category with id: ${id}`);

    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Category with id ${id} not found`);

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<void> {
    this.logger.debug(`Restoring category with id: ${id}`);

    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Category with id ${id} not found`);

    if (!existing.deletedAt)
      throw new BadRequestException('Category is not deleted');

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: null },
    });

    this.logger.debug(`Successfully restored category with id: ${id}`);
  }
}
