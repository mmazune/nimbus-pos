import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportStatementLineDto {
  @IsDateString()
  txDate!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsIn(['DEBIT', 'CREDIT'])
  direction!: string;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class ImportBankStatementDto {
  @IsString()
  bankAccountId!: string;

  @IsDateString()
  statementDate!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber()
  openingBalance!: number;

  @IsNumber()
  closingBalance!: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStatementLineDto)
  lines!: ImportStatementLineDto[];
}
