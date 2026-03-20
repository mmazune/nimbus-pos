import { IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class TaxCategory {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  vatPct!: number;
}

/**
 * Update the org's tax / VAT matrix.
 * Shape: { defaultVatPct: number, categories: TaxCategory[] }
 */
export class UpdateTaxMatrixDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultVatPct!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxCategory)
  categories?: TaxCategory[];
}
