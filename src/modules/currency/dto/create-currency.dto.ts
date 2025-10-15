import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'US Dollar' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '$' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ example: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @ApiProperty({ example: 12600.0 })
  @IsNumber()
  rateToMain?: number;
}
