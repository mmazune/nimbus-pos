import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'theoreticalUnitCost must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'theoreticalUnitCost must be a positive decimal with up to 3 decimal places',
  })
  theoreticalUnitCost?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'reorderLevel must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'reorderLevel must be a non-negative decimal with up to 3 decimal places',
  })
  reorderLevel?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'reorderQty must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'reorderQty must be a non-negative decimal with up to 3 decimal places',
  })
  reorderQty?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'theoreticalUnitCost must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'theoreticalUnitCost must be a positive decimal with up to 3 decimal places',
  })
  theoreticalUnitCost?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'reorderLevel must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'reorderLevel must be a non-negative decimal with up to 3 decimal places',
  })
  reorderLevel?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'reorderQty must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'reorderQty must be a non-negative decimal with up to 3 decimal places',
  })
  reorderQty?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
