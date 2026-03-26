import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconcileTillDto {
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  countedCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  varianceReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
