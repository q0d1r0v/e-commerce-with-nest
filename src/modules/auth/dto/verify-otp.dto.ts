import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPhoneNumber } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty()
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty()
  @IsNumber()
  code: number;
}
