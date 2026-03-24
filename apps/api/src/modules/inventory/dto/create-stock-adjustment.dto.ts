import { IsString, IsNotEmpty, IsOptional, IsNumberString, Matches } from 'class-validator';

export class CreateStockAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumberString({}, { message: 'qtyDelta must be a decimal-safe string' })
  @Matches(/^-?\d+(\.\d{1,3})?$/, {
    message: 'qtyDelta must be a decimal with up to 3 decimal places (positive or negative)',
  })
  qtyDelta!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
