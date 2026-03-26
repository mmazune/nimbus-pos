import { IsString, IsOptional, IsInt, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  bookingOpensAt?: string;

  @IsOptional()
  @IsDateString()
  bookingClosesAt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  venueTableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  venueNotes?: string;
}
