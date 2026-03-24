import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @IsString()
  @IsNotEmpty()
  inventoryItemId!: string;

  @IsOptional()
  @IsString()
  menuItemServingId?: string;

  @IsOptional()
  @IsString()
  modifierOptionId?: string;

  @IsNumberString({}, { message: 'qtyPerUnit must be a decimal-safe string' })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'qtyPerUnit must be a positive decimal with up to 3 decimal places',
  })
  qtyPerUnit!: string;

  @IsOptional()
  @IsNumberString({}, { message: 'wastePct must be a decimal-safe string' })
  wastePct?: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}
