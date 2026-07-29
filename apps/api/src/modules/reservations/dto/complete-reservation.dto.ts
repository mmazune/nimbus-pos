import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Prompt 4A — manual SEATED → COMPLETED completion payload.
 * Optional operator note only; the target status is never client-supplied.
 */
export class CompleteReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
