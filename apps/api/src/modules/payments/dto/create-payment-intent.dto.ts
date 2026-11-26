import { IsMoney } from '../../../common/validation/is-money';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  orderId!: string;

  @IsEnum(['MTN', 'AIRTEL'], { message: 'provider must be MTN or AIRTEL' })
  provider!: 'MTN' | 'AIRTEL';

  // E1F (S5, S6): a decimal string, at most 2 decimals, never above the DECIMAL(12,2) column
  @IsMoney({ min: '0.01', max: '9999999999.99' })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsString()
  @MaxLength(20)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
