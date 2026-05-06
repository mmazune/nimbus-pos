import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { VendorBillSourceTypeDto } from './create-vendor-bill.dto';

export enum RecurrenceCadenceDto {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export class CreateRecurringProfileDto {
  @IsString()
  supplierId!: string;

  @IsString()
  @MaxLength(200)
  profileName!: string;

  @IsEnum(RecurrenceCadenceDto)
  cadence!: RecurrenceCadenceDto;

  /** Expected bill amount per cycle (string for Decimal safety). */
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'expectedAmount must be a valid decimal string' })
  expectedAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsDateString()
  nextDueDate!: string;

  /** Days before due date to generate the bill. Default 7. */
  @IsOptional()
  @IsInt()
  @Min(0)
  leadDays?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(VendorBillSourceTypeDto)
  sourceType?: VendorBillSourceTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateRecurringProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  profileName?: string;

  @IsOptional()
  @IsEnum(RecurrenceCadenceDto)
  cadence?: RecurrenceCadenceDto;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'expectedAmount must be a valid decimal string' })
  expectedAmount?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadDays?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
