import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClickCallbackService } from './click-callback.service';

interface ClickPrepareRequest {
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

interface ClickCompleteRequest {
  click_trans_id: number;
  service_id: number;
  click_paydoc_id: number;
  merchant_trans_id: string;
  merchant_prepare_id: number;
  amount: number;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

@Controller('click/callback')
export class ClickCallbackController {
  private readonly logger = new Logger(ClickCallbackController.name);

  constructor(private readonly clickCallbackService: ClickCallbackService) {}

  /**
   * PREPARE - Click to'lov oldidan tekshirish
   * Click bu endpoint ga request yuboradi
   */
  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  async prepare(@Body() dto: ClickPrepareRequest) {
    this.logger.log(
      `Prepare request received: ${JSON.stringify(dto, null, 2)}`,
    );

    try {
      const response = await this.clickCallbackService.handlePrepare(dto);
      this.logger.log(`Prepare response: ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (error: unknown) {
      this.logger.error('Prepare error:', error);
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: 0,
        error: -1,
        error_note: 'Internal server error',
      };
    }
  }

  /**
   * COMPLETE - To'lovni yakunlash
   * Click to'lov muvaffaqiyatli bo'lgandan keyin bu endpoint ga request yuboradi
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Body() dto: ClickCompleteRequest) {
    this.logger.log(
      `Complete request received: ${JSON.stringify(dto, null, 2)}`,
    );

    try {
      const response = await this.clickCallbackService.handleComplete(dto);
      this.logger.log(
        `Complete response: ${JSON.stringify(response, null, 2)}`,
      );
      return response;
    } catch (error: unknown) {
      this.logger.error('Complete error:', error);
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: 0,
        error: -1,
        error_note: 'Internal server error',
      };
    }
  }
}
