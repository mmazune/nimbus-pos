import { IsOptional, IsString } from 'class-validator';

export class NpsSummaryQueryDto {
  @IsOptional()
  @IsString()
  windowStart?: string;

  @IsOptional()
  @IsString()
  windowEnd?: string;
}
