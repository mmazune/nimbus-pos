import { IsString, IsOptional, IsDateString, IsNumber, IsIn } from 'class-validator';

export class CreateManualBankEntryDto {
  @IsString()
  bankAccountId!: string;

  @IsDateString()
  txDate!: string;

  @IsNumber()
  amount!: number;

  @IsIn(['DEBIT', 'CREDIT'])
  direction!: string;

  @IsString()
  description!: string;

  @IsIn(['BANK_CHARGE', 'BANK_INTEREST', 'TRANSFER_FEE', 'CORRECTION', 'MISCELLANEOUS'])
  entryType!: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
