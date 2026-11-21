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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  authCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  terminalId?: string;

  @IsOptional()
  @IsEnum(MomoNetwork)
  momoNetwork?: MomoNetwork;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalTransactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
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
