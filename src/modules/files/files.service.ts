import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { Prisma, File } from '@prisma/client';
import { PaginatedResult } from '@/src/common/interfaces/paginated-result.interface';
import { paginate } from '@/src/common/utils/paginate';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(file: Express.Multer.File) {
    if (!file) throw new NotFoundException('File not provided');

    const filePath = join('uploads', file.filename);

    return this.prisma.file.create({
      data: {
        name: file.filename,
        path: filePath,
      },
    });
  }

  async uploadMany(files: Express.Multer.File[]) {
    if (!files?.length) throw new NotFoundException('No files provided');

    const createdFiles = await Promise.all(
      files.map((file) =>
        this.prisma.file.create({
          data: {
            name: file.filename,
            path: `uploads/${file.filename}`,
          },
        }),
      ),
    );

    return createdFiles;
  }

  async findById(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id, deletedAt: null },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async findAll(
    pagination: PaginationDto,
    search?: string,
  ): Promise<PaginatedResult<File>> {
    const where: Prisma.FileWhereInput = search
      ? {
          name: { contains: search, mode: 'insensitive' },
          deletedAt: null,
        }
      : { deletedAt: null };

    return paginate<
      File,
      Prisma.FileWhereInput,
      Prisma.FileOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.file,
      where,
      orderBy: { createdAt: 'desc' },
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async update(id: string, file: Express.Multer.File) {
    const existing = await this.prisma.file.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('File not found');

    if (!file) throw new NotFoundException('File not provided');

    if (existsSync(existing.path)) {
      unlinkSync(existing.path);
    }

    return this.prisma.file.update({
      where: { id },
      data: {
        name: file.filename,
        path: file.path,
      },
    });
  }

  async delete(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    return this.prisma.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    return this.prisma.file.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
