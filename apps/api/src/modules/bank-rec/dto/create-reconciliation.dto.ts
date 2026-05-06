import { IsString, IsOptional } from 'class-validator';

export class CreateReconciliationDto {
  @IsString()
  bankAccountId!: string;

  @IsString()
  @IsOptional()
  bankStatementId?: string;

  @IsString()
  @IsOptional()
  fiscalPeriodId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
