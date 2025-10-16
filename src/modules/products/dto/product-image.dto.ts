import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class ProductImageDto {
  @ApiProperty({
    example: 'f28a1f9c-5b83-4f8a-85a3-7e6c0c8efb1e',
    description: 'The ID of the file (foreign key from the File table)',
  })
  @IsString()
  fileId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Indicates whether this is the main image (optional)',
  })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'The order index for sorting images (optional)',
  })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
