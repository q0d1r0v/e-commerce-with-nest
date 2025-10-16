import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ChangeActiveStatusDto {
  @ApiProperty({
    example: true,
    description: 'Set product active status (true = active, false = inactive)',
    required: true,
  })
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive: boolean;
}
