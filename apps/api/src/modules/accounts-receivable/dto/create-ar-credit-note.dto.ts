import { IsString, IsOptional, IsNotEmpty, MaxLength, IsDateString } from 'class-validator';

export class CreateArCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  customerAccountId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  /** ISO date: YYYY-MM-DD */
  @IsDateString()
  creditNoteDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /** Amount as Decimal-safe string. */
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
