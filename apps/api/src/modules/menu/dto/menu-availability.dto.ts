import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** T2 phase 1 (E2) — set a number left ("12 goat stews left"). */
export class SetMenuItemLeftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  left!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  lowAt?: number;
}

export class AvailabilitySinceQueryDto {
  @IsOptional()
  @IsISO8601()
  since?: string;
}
