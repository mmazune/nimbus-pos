import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateStockBatchDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsNumberString({}, { message: 'receivedQty must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'receivedQty must be a positive decimal with up to 3 decimal places',
  })
  receivedQty!: string;

  @IsNumberString({}, { message: 'unitCost must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'unitCost must be a positive decimal with up to 2 decimal places',
  })
  unitCost!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  goodsReceiptId?: string;
}
