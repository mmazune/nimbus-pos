import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  name!: string;

  @IsString()
  accountCode!: string;

  @IsString()
  bankName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyCode?: string;

  @IsString()
  @IsOptional()
  glAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
