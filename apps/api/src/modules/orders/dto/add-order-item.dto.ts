import { Max, IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class AddOrderItemDto {
  @IsString()
  menuItemId!: string;

  @IsOptional()
  @IsString()
  menuItemServingId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  // T2 phase 2 (E3): which guest at the table the line is for (split by guest)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  guest?: number;
}
