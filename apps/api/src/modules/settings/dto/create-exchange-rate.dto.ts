import { IsString, MaxLength, IsDateString } from 'class-validator';

/**
 * Create a new exchange rate entry.
 * Rate is a Decimal-safe string. effectiveAt is an ISO 8601 date-time.
 */
export class CreateExchangeRateDto {
  @IsString()
  @MaxLength(10)
  baseCurrencyCode!: string;

  @IsString()
  @MaxLength(10)
  quoteCurrencyCode!: string;

  /** Decimal-safe rate string, e.g. "3700.000000" */
  @IsString()
  rate!: string;

  @IsDateString()
  effectiveAt!: string;
}
