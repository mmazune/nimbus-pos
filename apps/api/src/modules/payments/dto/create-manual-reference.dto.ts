import { IsMoney } from '../../../common/validation/is-money';
import { IsString, IsOptional, IsEnum, IsDateString, MaxLength } from 'class-validator';

export class CreateManualReferencePaymentDto {
  @IsString()
  orderId!: string;

  @IsEnum(['MOMO', 'CARD', 'BANK_TRANSFER'], {
    message: 'method must be MOMO, CARD, or BANK_TRANSFER',
  })
  method!: 'MOMO' | 'CARD' | 'BANK_TRANSFER';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  // E1F (S5, S6): a decimal string, at most 2 decimals, never above the DECIMAL(12,2) column
  @IsMoney({ min: '0.01', max: '9999999999.99' })
  amount!: string;

  @IsString()
  @MaxLength(200)
  externalTransactionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  payerPhone?: string;

  @IsOptional()
  @IsDateString()
  postedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
