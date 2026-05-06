import {
    ArrayMinSize,
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    Min,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SplitItemSelectionDto {
    @IsString()
    orderItemId!: string;

    /** Quantity to move to the child order (1..source.quantity). */
    @IsInt()
    @Min(1)
    quantity!: number;
}

/**
 * BG4.B — Physical split: lifts selected items / quantities off the source
 * order into a NEW child order with `splitFromOrderId = source.id`. The
 * child starts in NEW status and must be explicitly re-sent to KDS by the
 * operator. Existing KDS tickets are NOT republished automatically.
 */
export class SplitItemsDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => SplitItemSelectionDto)
    items!: SplitItemSelectionDto[];

    /** Optional: assign the new child order to a different (open) table. */
    @IsOptional()
    @IsString()
    targetTableId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    notes?: string;
}
