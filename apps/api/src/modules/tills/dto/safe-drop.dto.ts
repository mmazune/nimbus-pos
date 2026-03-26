import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SafeDropDto {
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}
