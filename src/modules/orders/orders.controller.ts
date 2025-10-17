import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { Roles } from '@/src/decorators/roles.decorator';
import { RolesGuard } from '@/src/guards/roles.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Orders')
@UseGuards(RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('/create')
  @Roles(['USER', 'ADMIN'])
  @ApiOperation({ summary: 'Create new order' })
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get('/load')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Get all orders with pagination' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.ordersService.findAll(pagination, search);
  }

  @Get('/get/:id')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update order status' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Delete order' })
  async delete(@Param('id') id: string) {
    await this.ordersService.delete(id);
    return { message: `Order with id ${id} has been deleted` };
  }
}
