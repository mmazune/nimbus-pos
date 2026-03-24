import { IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  orderId!: string;

  @IsEnum(['MTN', 'AIRTEL'], { message: 'provider must be MTN or AIRTEL' })
  provider!: 'MTN' | 'AIRTEL';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
