import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({
    example: 'Nike',
    description: 'Brand name',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'A popular sportswear brand',
    description: 'Brand description (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'f28a1f9c-5b83-4f8a-85a3-7e6c0c8efb1e',
    description: 'Logo file ID (foreign key to File table, optional)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  logoId?: string;

  @ApiProperty({
    example: true,
    description: 'Indicates whether the brand is active (optional)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
