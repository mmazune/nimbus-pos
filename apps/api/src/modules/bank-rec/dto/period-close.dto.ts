import { IsString, IsOptional } from 'class-validator';

export class PeriodCloseDto {
  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  retainedEarningsAccountId?: string;
}
