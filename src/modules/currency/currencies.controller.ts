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
import { CurrenciesService } from '@/src/modules/currency/currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { PaginationDto } from '@/src/common/dto/pagination.dto';

@ApiTags('Currencies')
@UseGuards(RolesGuard)
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post('/admin/create')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Create new currency' })
  async create(@Body() dto: CreateCurrencyDto) {
    return this.currenciesService.create(dto);
  }

  @Get('/load')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get all currencies' })
  async findAll(
    @Query() PaginationDto: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.currenciesService.findAll(PaginationDto, search);
  }

  @Get('/get/:id')
  @Roles(['ADMIN', 'USER'])
  @ApiOperation({ summary: 'Get currency by ID' })
  async findOne(@Param('id') id: string) {
    return this.currenciesService.findById(id);
  }

  @Patch('/admin/update/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Update currency (rate, name, etc.)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currenciesService.update(id, dto);
  }

  @Delete('/admin/delete/:id')
  @Roles(['ADMIN'])
  @ApiOperation({ summary: 'Delete currency' })
  async delete(@Param('id') id: string) {
    await this.currenciesService.delete(id);
    return { message: `Currency with id ${id} has been deleted` };
  }
}
