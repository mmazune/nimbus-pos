import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaxCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  efirsTaxCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
