import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';

export class MarkNoShowDto {
  @IsOptional()
  @IsEnum(['FORFEIT', 'REFUND', 'NO_DEPOSIT'])
  depositOutcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
