import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum VendorBillSourceTypeDto {
  MANUAL_SERVICE = 'MANUAL_SERVICE',
  GRN_LINKED = 'GRN_LINKED',
  EXPENSE = 'EXPENSE',
  RECURRING = 'RECURRING',
  ONE_OFF_EVENT = 'ONE_OFF_EVENT',
  UTILITY = 'UTILITY',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export class VendorBillLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  /** Quantity as a numeric value (e.g. 1, 2.5). Will be stored as Decimal. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  /** Unit price as a string to preserve Decimal-safety at boundaries. */
  @IsString()
  @IsNotEmpty()
  unitPrice!: string;

  /** Tax rate percentage (e.g. 18 for 18%). Defaults to 0. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  /** Optional GL account for this line. */
  @IsOptional()
  @IsString()
  accountId?: string;

  /** Optional cost center for this line. */
  @IsOptional()
  @IsString()
  costCenterId?: string;

  /** Optional inventory item reference. */
  @IsOptional()
  @IsString()
  itemId?: string;
}

export class CreateVendorBillDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsEnum(VendorBillSourceTypeDto)
  sourceType!: VendorBillSourceTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceDocumentId?: string;

  /** ISO date string: YYYY-MM-DD */
  @IsDateString()
  billDate!: string;

  /** ISO date string: YYYY-MM-DD */
  @IsDateString()
  issueDate!: string;

  /** ISO date string: YYYY-MM-DD */
  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsDateString()
  servicePeriodStart?: string;

  @IsOptional()
  @IsDateString()
  servicePeriodEnd?: string;

  @IsOptional()
  @IsString()
  recurringProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorBillLineDto)
  lines!: VendorBillLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
