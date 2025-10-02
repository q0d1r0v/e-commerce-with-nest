import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;
}
