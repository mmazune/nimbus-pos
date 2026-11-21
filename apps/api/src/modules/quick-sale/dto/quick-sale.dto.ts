import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CardScheme, MomoNetwork } from '@prisma/client';
import { normalizeTillCode } from '../till-code';

/**
 * POST /api/pos/quick-sale. Brand, last four, approval code and terminal ID only: there is
 * deliberately no field that could carry a full card number, expiry or security code.
 */
export class QuickSaleLineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  menuItemId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  menuItemServingId?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class QuickSalePaymentDto {
  @IsIn(['CASH', 'CARD', 'MOMO'])
  method!: 'CASH' | 'CARD' | 'MOMO';

  /** Cash only. Absent means "exact". Whole shillings or up to two decimals. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  tenderedAmount?: number;

  @IsOptional()
  @IsEnum(CardScheme)
  cardScheme?: CardScheme;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'cardLast4 must be exactly 4 digits' })
  cardLast4?: string;

  /** Letters and digits, at most 8: a 16-digit card number cannot be typed in here (H1F). */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,8}$/, {
    message: 'authCode must be 1 to 8 letters or digits',
  })
  authCode?: string;

  /** Letters, digits and dashes, at most 12 (H1F). */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,12}$/, {
    message: 'terminalId must be 1 to 12 letters, digits or dashes',
  })
  terminalId?: string;

  @IsOptional()
  @IsEnum(MomoNetwork)
  momoNetwork?: MomoNetwork;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalTransactionId?: string;

  /** A phone number: optional +, 7 to 12 digits, single spaces or dashes between groups. At most 12
   * digits, so no 13 to 19 digit card number can be typed in here (H1F). Mobile-money only. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?\d(?:[ -]?\d){6,11}$/, {
    message: 'payerPhone must look like a phone number (7 to 12 digits)',
  })
  payerPhone?: string;
}

export class QuickSaleDto {
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'clientSaleId must be 8 to 64 characters of A-Z, a-z, 0-9, _ or -',
  })
  clientSaleId!: string;

  /** Stored trimmed and upper-cased (H1F): `drk-03` and `DRK-03 ` are the till `DRK-03`. */
  @Transform(({ value }) => normalizeTillCode(value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  tillCode!: string;

  /** ISO 8601 time WITH an offset (Z or +03:00). Stored as given; never used for ordering. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, {
    message: 'soldAt must be an ISO 8601 time with a UTC offset',
  })
  soldAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuickSaleLineDto)
  lines!: QuickSaleLineDto[];

  /** Exactly one payment (EV-5): an object, never an array. */
  @IsObject()
  @ValidateNested()
  @Type(() => QuickSalePaymentDto)
  payment!: QuickSalePaymentDto;
}
