import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '@/src/middleware/auth.middleware';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user-dto';

@ApiTags('Users')
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Create new user' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('me')
  @Roles(['ADMIN', 'USER'])
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('get/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get('load')
  @Roles(['ADMIN'])
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(pagination, search);
  }

  @Patch('update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update user by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete('delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Soft delete user by ID' })
  async softDelete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { message: `User with id ${id} has been soft deleted` };
  }

  @Patch('restore/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Restore soft-deleted user' })
  async restore(@Param('id') id: string) {
    await this.usersService.restore(id);
    return { message: `User with id ${id} has been restored` };
  }
}
