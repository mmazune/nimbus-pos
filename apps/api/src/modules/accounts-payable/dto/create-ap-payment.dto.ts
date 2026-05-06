import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentAllocationDto {
  @IsString()
  @IsNotEmpty()
  vendorBillId!: string;

  /** Amount to allocate in string form for Decimal-safety. */
  @IsString()
  @IsNotEmpty()
  amount!: string;
}

export class CreateApPaymentDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  /** ISO date string: YYYY-MM-DD */
  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /** Total payment amount as string for Decimal-safety. */
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
  @Type(() => PaymentAllocationDto)
  allocations!: PaymentAllocationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Optional GL account ID for the cash/bank debit side. */
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  /** Optional AP liability account ID for the credit side. */
  @IsOptional()
  @IsString()
  apAccountId?: string;
}
