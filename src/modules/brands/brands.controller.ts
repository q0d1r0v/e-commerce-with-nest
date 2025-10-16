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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { PaginationDto } from '@/src/common/dto/pagination.dto';

@ApiTags('Brands')
@UseGuards(RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post('/admin/create')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Create new brand' })
  async create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @Get('/load')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get all brands with pagination' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.brandsService.findAll(pagination, search);
  }

  @Get('/get/:id')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get brand by ID' })
  async findOne(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update brand' })
  async update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Delete brand' })
  async delete(@Param('id') id: string) {
    await this.brandsService.delete(id);
    return { message: `Brand with id ${id} has been deleted` };
  }
}
