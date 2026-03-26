import { IsString, IsOptional, IsInt, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  bookingOpensAt?: string;

  @IsOptional()
  @IsDateString()
  bookingClosesAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  venueTableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  venueNotes?: string;
}
