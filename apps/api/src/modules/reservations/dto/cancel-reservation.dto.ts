import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class CancelReservationDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsEnum(['REFUND', 'FORFEIT', 'NO_DEPOSIT'])
  depositOutcome?: string;
}
