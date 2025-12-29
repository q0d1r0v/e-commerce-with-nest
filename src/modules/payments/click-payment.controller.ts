import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClickPaymentService } from './click-payment.service';
import { Roles } from '@/src/decorators/roles.decorator';
import { RolesGuard } from '@/src/guards/roles.guard';
import { CurrentUser } from '@/src/decorators/current-user.decorator';
import {
  CreateClickInvoiceDto,
  RequestCardTokenDto,
  VerifyCardTokenDto,
  PaymentWithTokenDto,
  DeleteCardTokenDto,
} from './dto/click-payment.dto';

@ApiTags('Click Payments')
@UseGuards(RolesGuard)
@Controller('click')
export class ClickPaymentController {
  constructor(private readonly clickPaymentService: ClickPaymentService) {}

  @Post('invoice/create')
  @Roles(['USER', 'ADMIN'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Click invoice for payment' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createInvoice(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateClickInvoiceDto,
  ) {
    return this.clickPaymentService.createInvoice(userId, dto);
  }

  @Get('invoice/status/:invoiceId')
  @Roles(['USER', 'ADMIN'])
  @ApiOperation({ summary: 'Check Click invoice status' })
  @ApiResponse({ status: 200, description: 'Invoice status retrieved' })
  async checkInvoiceStatus(@Param('invoiceId') invoiceId: string) {
    return this.clickPaymentService.checkInvoiceStatus(parseInt(invoiceId));
  }

  @Post('card/request-token')
  @Roles(['USER', 'ADMIN'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request card token for saved card payments' })
  @ApiResponse({ status: 200, description: 'Card token requested, SMS sent' })
  @ApiResponse({ status: 400, description: 'Invalid card data' })
  async requestCardToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestCardTokenDto,
  ) {
    return this.clickPaymentService.requestCardToken(userId, dto);
  }

  @Post('card/verify-token')
  @Roles(['USER', 'ADMIN'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify card token with SMS code' })
  @ApiResponse({ status: 200, description: 'Card token verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid SMS code' })
  async verifyCardToken(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyCardTokenDto,
  ) {
    return this.clickPaymentService.verifyCardToken(userId, dto);
  }

  @Post('payment/with-token')
  @Roles(['USER', 'ADMIN'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make payment with verified card token' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Payment failed' })
  async paymentWithToken(
    @CurrentUser('id') userId: string,
    @Body() dto: PaymentWithTokenDto,
  ) {
    return this.clickPaymentService.paymentWithToken(userId, dto);
  }

  @Get('payment/status/:paymentId')
  @Roles(['USER', 'ADMIN'])
  @ApiOperation({ summary: 'Check Click payment status by payment ID' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  async checkPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.clickPaymentService.checkPaymentStatus(paymentId);
  }

  @Get('payment/check-by-order/:orderId/:date')
  @Roles(['USER', 'ADMIN'])
  @ApiOperation({ summary: 'Check payment by order ID and date' })
  @ApiResponse({ status: 200, description: 'Payment info retrieved' })
  async checkPaymentByOrder(
    @Param('orderId') orderId: string,
    @Param('date') date: string,
  ) {
    return this.clickPaymentService.checkPaymentByOrder(orderId, date);
  }

  @Delete('payment/cancel/:paymentId')
  @Roles(['ADMIN'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel/reverse a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel payment' })
  async cancelPayment(@Param('paymentId') paymentId: string) {
    return this.clickPaymentService.cancelPayment(paymentId);
  }

  @Delete('card/delete-token')
  @Roles(['USER', 'ADMIN'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete saved card token' })
  @ApiResponse({ status: 200, description: 'Card token deleted' })
  async deleteCardToken(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteCardTokenDto,
  ) {
    return this.clickPaymentService.deleteCardToken(userId, dto.cardToken);
  }

  @Get('user/saved-cards')
  @Roles(['USER', 'ADMIN'])
  @ApiOperation({ summary: 'Get user saved cards' })
  @ApiResponse({ status: 200, description: 'User saved cards retrieved' })
  async getUserSavedCards(@CurrentUser('id') userId: string) {
    return this.clickPaymentService.getUserSavedCards(userId);
  }
}
