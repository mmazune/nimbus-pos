import { IsOptional, IsString, IsDateString, IsNumberString } from 'class-validator';

export class AgingQueryDto {
  /** Compute aging as of this date (ISO date). Defaults to today. */
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
