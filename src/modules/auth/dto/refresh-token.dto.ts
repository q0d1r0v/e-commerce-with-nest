import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Old refresh token' })
  @IsString()
  @IsNotEmpty()
  oldRefreshToken: string;
}
