import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

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
}
