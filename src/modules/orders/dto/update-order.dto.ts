import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.PAID,
    description: 'Update order status',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}
