import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  IsNumber,
  MaxLength,
  Min,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @IsString()
  @MaxLength(200)
  customerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  partySize!: number;

  @IsDateString()
  reservationAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedDurationMinutes?: number;

  @IsOptional()
  @IsEnum(['WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'MANUAL', 'OTHER'])
  source?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositRequired?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
