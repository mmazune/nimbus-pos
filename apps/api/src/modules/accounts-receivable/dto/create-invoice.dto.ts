import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsPositive,
  Min,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceSourceTypeEnum {
  DIRECT_BILL = 'DIRECT_BILL',
  EVENT = 'EVENT',
  RESERVATION = 'RESERVATION',
  CORPORATE = 'CORPORATE',
  MANUAL = 'MANUAL',
}

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  /** Quantity as number */
  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Unit price as string (Decimal-safe) */
  @IsString()
  @IsNotEmpty()
  unitPrice!: string;

  /** Tax rate as percentage, e.g. 18 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  customerAccountId!: string;

  @IsOptional()
  @IsEnum(InvoiceSourceTypeEnum)
  sourceType?: InvoiceSourceTypeEnum;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  /** ISO date: YYYY-MM-DD */
  @IsDateString()
  invoiceDate!: string;

  /** ISO date: YYYY-MM-DD */
  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
