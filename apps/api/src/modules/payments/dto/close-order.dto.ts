import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CloseOrderPaymentDto {
  @IsEnum(['CASH', 'CARD', 'MOMO', 'BANK_TRANSFER'], {
    message: 'method must be CASH, CARD, MOMO, or BANK_TRANSFER',
  })
  method!: 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CloseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CloseOrderPaymentDto)
  payments!: CloseOrderPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
