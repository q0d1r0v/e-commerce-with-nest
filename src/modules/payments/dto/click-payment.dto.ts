import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';

export class CreateClickInvoiceDto {
  @ApiProperty({ example: 'order-uuid', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 100000, description: 'Amount in sum' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: '998901234567', description: 'User phone number' })
  @IsString()
  @Matches(/^998\d{9}$/, {
    message: 'Phone number must start with 998 and have 12 digits',
  })
  phoneNumber: string;
}

export class RequestCardTokenDto {
  @ApiProperty({
    example: '8600123456789012',
    description: 'Card number (16 digits)',
  })
  @IsString()
  @Matches(/^\d{16}$/, { message: 'Card number must be 16 digits' })
  cardNumber: string;

  @ApiProperty({ example: '1225', description: 'Card expiry date MMYY format' })
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\d{2}$/, {
    message: 'Expire date must be in MMYY format',
  })
  expireDate: string;

  @ApiProperty({
    example: false,
    description: 'Create temporary token (one-time use)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  temporary?: boolean;
}

export class VerifyCardTokenDto {
  @ApiProperty({
    example: '3B1DF3F1-7358-407C-B57F-0F6351310803',
    description: 'Card token from request',
  })
  @IsString()
  cardToken: string;

  @ApiProperty({ example: '123456', description: 'SMS verification code' })
  @IsString()
  @Length(4, 6)
  smsCode: string;
}

export class PaymentWithTokenDto {
  @ApiProperty({
    example: '3B1DF3F1-7358-407C-B57F-0F6351310803',
    description: 'Verified card token',
  })
  @IsString()
  cardToken: string;

  @ApiProperty({ example: 'order-uuid', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 100000, description: 'Payment amount in sum' })
  @IsNumber()
  amount: number;
}

export class CheckClickPaymentDto {
  @ApiProperty({ example: '123456789', description: 'Click payment ID' })
  @IsString()
  paymentId: string;
}

export class CheckPaymentByOrderDto {
  @ApiProperty({
    example: 'order-uuid',
    description: 'Merchant transaction ID (Order ID)',
  })
  @IsString()
  merchantTransId: string;

  @ApiProperty({
    example: '2024-12-30',
    description: 'Payment date in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  date: string;
}

export class DeleteCardTokenDto {
  @ApiProperty({
    example: '3B1DF3F1-7358-407C-B57F-0F6351310803',
    description: 'Card token to delete',
  })
  @IsString()
  cardToken: string;
}
