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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { ChangeActiveStatusDto } from './dto/change-active-status.dto';

@ApiTags('Products')
@UseGuards(RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('/admin/create')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Create new product' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get('/load')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get all products with pagination' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(pagination, search);
  }

  @Get('/get/:id')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Soft delete product' })
  async delete(@Param('id') id: string) {
    await this.productsService.delete(id);
    return { message: `Product with id ${id} has been deleted` };
  }

  @Patch('/admin/restore/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Restore soft-deleted product' })
  async restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Patch('/admin/change-active/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Change product active status (true/false)' })
  async changeActiveStatus(
    @Param('id') id: string,
    @Body() dto: ChangeActiveStatusDto,
  ) {
    return this.productsService.changeActiveStatus(id, dto.isActive);
  }
}
