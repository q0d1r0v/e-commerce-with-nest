import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsPhoneNumber()
  phoneNumber: string;
}
