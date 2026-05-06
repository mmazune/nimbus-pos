import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiptAllocationLineDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  /** Amount to allocate (Decimal-safe string). e.g. "500.00" */
  @IsString()
  @IsNotEmpty()
  amount!: string;
}

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  customerAccountId!: string;

  /** ISO date: YYYY-MM-DD */
  @IsDateString()
  receiptDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /** Total receipt amount (Decimal-safe string). */
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ReceiptAllocationLineDto)
  allocations!: ReceiptAllocationLineDto[];

  /** Optional GL debit account (cash/bank account) for posting. */
  @IsOptional()
  @IsString()
  debitAccountId?: string;

  /** Optional GL credit account (AR receivable account) for posting. */
  @IsOptional()
  @IsString()
  arAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
