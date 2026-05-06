import { IsString, IsOptional, IsDateString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  /** ISO date string: YYYY-MM-DD */
  @IsDateString()
  issueDate!: string;

  /** ISO date string: YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /** Total credit note value as string for Decimal-safety. */
  @IsString()
  @IsNotEmpty()
  totalAmount!: string;

  @IsOptional()
  @IsString()
  sourceBillId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
