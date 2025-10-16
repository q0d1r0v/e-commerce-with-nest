import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductImageDto } from './product-image.dto';

export class CreateProductDto {
  @ApiProperty({
    example: 'Smartphone Redmi Note 13',
    description: 'Product name',
    required: true,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'The new generation Redmi Note 13 with 8GB RAM and 256GB storage',
    description: 'Product description (optional)',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 299.99,
    description: 'Base price (Decimal(12,2), in UZS or main currency)',
    required: true,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must be a number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Price must be greater than or equal to 0' })
  @Max(9999999999.99, {
    message: 'Price exceeds the allowed range (Decimal(12,2))',
  })
  price: number;

  @ApiPropertyOptional({
    example: 249.99,
    description: 'Discounted price (optional)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must be a number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Price must be greater than or equal to 0' })
  @Max(9999999999.99, {
    message: 'Price exceeds the allowed range (Decimal(12,2))',
  })
  discountPrice?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Available stock quantity (optional)',
  })
  @IsOptional()
  @IsNumber()
  stock?: number;

  @ApiProperty({
    example: 'a3f7b63c-9d23-4b61-b9b3-5c4e0af6a2b9',
    description: 'Category ID (foreign key)',
    required: true,
  })
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({
    example: 'dce7313a-73c9-4a9d-b58a-4e85f97c5f1b',
    description: 'Brand ID (optional)',
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Product activity status (true = active, false = inactive)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'List of product images (optional)',
    type: [ProductImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}
