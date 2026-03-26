import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenTillDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  tillCode!: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  openingFloat!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
