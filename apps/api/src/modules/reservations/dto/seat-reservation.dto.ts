import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class SeatReservationDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsBoolean()
  createOrder?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  orderNotes?: string;
}
