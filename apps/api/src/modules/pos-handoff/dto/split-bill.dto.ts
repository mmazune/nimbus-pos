import {
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * BG4.B — Split-bill mode.
 *
 * NOTE: split-bill is intentionally NOT a physical order split. It records
 * payable allocation groups against the existing order so the cashier can
 * collect partial payments from each diner. The order, items, taxes and
 * KDS tickets are untouched.
 */
export enum SplitBillMode {
    EQUAL = 'EQUAL',
    CUSTOM = 'CUSTOM',
}

export class SplitBillGroupInputDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    label?: string;

    /** Decimal-as-string, e.g. "11.00". Required for CUSTOM mode. */
    @IsOptional()
    @IsString()
    @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a positive decimal with up to 2 dp' })
    amount?: string;
}

export class SplitBillDto {
    @IsEnum(SplitBillMode)
    mode!: SplitBillMode;

    /** Required for EQUAL mode. Number of split groups (2..20). */
    @IsOptional()
    @IsInt()
    @Min(2)
    @Max(20)
    count?: number;

    /** Required for CUSTOM mode. Sum of group amounts must equal order.total. */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SplitBillGroupInputDto)
    groups?: SplitBillGroupInputDto[];

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
