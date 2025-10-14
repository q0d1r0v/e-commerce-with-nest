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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from '@/src/common/dto/pagination.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';

@ApiTags('Categories')
@UseGuards(RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post('/admin/create')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Create new category' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get('load')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get all categories with pagination' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.categoriesService.findAll(pagination, search);
  }

  @Get('get/:id')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update category by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Soft delete category by ID' })
  async delete(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return { message: `Category with id ${id} has been soft deleted` };
  }

  @Patch('/admin/restore/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Restore soft-deleted category' })
  async restore(@Param('id') id: string) {
    await this.categoriesService.restore(id);
    return { message: `Category with id ${id} has been restored` };
  }
}
