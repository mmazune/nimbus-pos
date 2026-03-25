import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

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

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

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
