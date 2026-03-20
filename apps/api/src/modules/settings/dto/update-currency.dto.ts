import { IsString, MaxLength, IsOptional } from 'class-validator';

/**
 * Update the org's primary currency and optional base currency code.
 */
export class UpdateCurrencyDto {
  /** ISO currency code, e.g. "UGX", "USD", "EUR" */
  @IsString()
  @MaxLength(10)
  currency!: string;

  /** Optional base currency for exchange rate calculations */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  baseCurrencyCode?: string;
}
