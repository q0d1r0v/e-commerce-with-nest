import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ example: 'product-uuid', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 120000, description: 'Price per product' })
  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 240000, description: 'Total order amount' })
  @IsNumber()
  total: number;

  @ApiProperty({ type: [OrderItemDto], description: 'List of order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
