import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
