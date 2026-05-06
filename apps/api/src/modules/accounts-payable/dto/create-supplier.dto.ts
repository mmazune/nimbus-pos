import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';

export enum CounterpartyTypeDto {
  INVENTORY_SUPPLIER = 'INVENTORY_SUPPLIER',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  UTILITY_PROVIDER = 'UTILITY_PROVIDER',
  SUBSCRIPTION_VENDOR = 'SUBSCRIPTION_VENDOR',
  CONTRACTOR = 'CONTRACTOR',
  FREELANCER = 'FREELANCER',
  ENTERTAINER = 'ENTERTAINER',
  LANDLORD = 'LANDLORD',
  OTHER = 'OTHER',
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsEnum(CounterpartyTypeDto)
  counterpartyType?: CounterpartyTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentTermDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
