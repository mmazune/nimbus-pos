import { IsMoney } from '../../../common/validation/is-money';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
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

  // E1F (S5, S6): a decimal string, at most 2 decimals, never above the DECIMAL(12,2) column
  @IsMoney({ min: '0.01', max: '9999999999.99' })
  amount!: string;

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
