import { IsString, IsOptional } from 'class-validator';

export class MatchLineDto {
  @IsString()
  bankStatementLineId!: string;

  @IsString()
  @IsOptional()
  journalLineId?: string;

  @IsString()
  @IsOptional()
  manualEntryId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
