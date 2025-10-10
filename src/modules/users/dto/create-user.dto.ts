import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ description: 'Phone number of the user' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Role of the user', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Optional file ID for user avatar' })
  @IsOptional()
  @IsString()
  fileId?: string;
}
