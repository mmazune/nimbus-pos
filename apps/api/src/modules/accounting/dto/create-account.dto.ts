import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export enum AccountTypeDto {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(AccountTypeDto)
  accountType!: AccountTypeDto;

  @IsOptional()
  @IsString()
  parentAccountId?: string;

  @IsOptional()
  @IsBoolean()
  systemManaged?: boolean;

  @IsOptional()
  @IsBoolean()
  allowManualPosting?: boolean;

  @IsOptional()
  @IsBoolean()
  taxRelevant?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
