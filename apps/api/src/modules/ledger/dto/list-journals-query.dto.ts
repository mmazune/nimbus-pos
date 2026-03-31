import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';

enum JournalStatusFilter {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export class ListJournalsQueryDto {
  @IsOptional()
  @IsEnum(JournalStatusFilter)
  status?: JournalStatusFilter;

  @IsOptional()
  @IsString()
  sourceKey?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
