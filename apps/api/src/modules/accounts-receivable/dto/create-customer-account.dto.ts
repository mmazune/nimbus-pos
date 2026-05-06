import { IsString, IsOptional, IsEmail, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';

export enum CustomerAccountTypeEnum {
  CORPORATE = 'CORPORATE',
  HOUSE = 'HOUSE',
  INDIVIDUAL = 'INDIVIDUAL',
}

export class CreateCustomerAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsEnum(CustomerAccountTypeEnum)
  type?: CustomerAccountTypeEnum;

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
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  /** Credit limit as a decimal string for Decimal-safety. e.g. "5000.00" */
  @IsOptional()
  @IsString()
  creditLimit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
