import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsEnum(['DINE_IN', 'TAKEAWAY'], { message: 'serviceType must be DINE_IN or TAKEAWAY' })
  serviceType!: 'DINE_IN' | 'TAKEAWAY';

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
