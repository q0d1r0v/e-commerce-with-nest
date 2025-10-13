import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { paginate } from '@/src/common/utils/paginate';
import { Prisma, User } from '@prisma/client';
import { LoggerService } from '../logger/logger.service';
import { UserDto } from './dto/user-dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user-dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UsersService.name);
  }

  private readonly defaultSelect = {
    id: true,
    fullName: true,
    phoneNumber: true,
    role: true,
    file: { select: { id: true, name: true, path: true } },
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  };

  async create(dto: CreateUserDto): Promise<UserDto> {
    this.logger.debug(`Creating user with phone: ${dto.phoneNumber}`);

    const existing = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existing)
      throw new BadRequestException(
        'User with this phone number already exists',
      );

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        password: hashedPassword,
        role: dto.role,
        fileId: dto.fileId,
      },
      select: this.defaultSelect,
    });

    return user;
  }

  async findById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: this.defaultSelect,
    });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  async findAll(pagination: PaginationDto, search?: string) {
    this.logger.debug('Fetching all users with pagination');
    const where: Prisma.UserWhereInput = search
      ? {
          fullName: { contains: search, mode: 'insensitive' },
          deletedAt: null,
        }
      : { deletedAt: null };

    return paginate<
      User,
      Prisma.UserWhereInput,
      Prisma.UserOrderByWithRelationInput
    >(this.prisma, {
      model: (prisma) => prisma.user,
      where,
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    this.logger.debug(`Updating user with id: ${id}`);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User with id ${id} not found`);

    let hashedPassword: string | undefined = undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        password: hashedPassword,
        role: dto.role,
        fileId: dto.fileId,
      },
      select: this.defaultSelect,
    });

    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Soft deleting user with id: ${id}`);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User with id ${id} not found`);

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedOriginalPhoneNumber: existing.phoneNumber,
        phoneNumber: `${existing.phoneNumber}_deleted_${Date.now()}`,
      },
    });
  }

  async restore(id: string): Promise<void> {
    this.logger.debug(`Restoring user with id: ${id}`);

    try {
      const existing = await this.prisma.user.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      if (!existing.deletedAt) {
        throw new BadRequestException(`User with id ${id} is not deleted`);
      }

      if (!existing.deletedOriginalPhoneNumber) {
        throw new BadRequestException(
          'Original phone number not found — cannot restore',
        );
      }

      const conflict = await this.prisma.user.findUnique({
        where: { phoneNumber: existing.deletedOriginalPhoneNumber },
      });

      if (conflict) {
        throw new BadRequestException(
          `Phone number ${existing.deletedOriginalPhoneNumber} is already in use`,
        );
      }

      await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: null,
          phoneNumber: existing.deletedOriginalPhoneNumber,
          deletedOriginalPhoneNumber: null,
        },
      });

      this.logger.debug(`Successfully restored user with id: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to restore user with id: ${id}`, error);
      throw error;
    }
  }
}
