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

export class MoveOrderItemSelectionDto {
    @IsString()
    orderItemId!: string;

    @IsInt()
    @Min(1)
    quantity!: number;
}

/**
 * BG4.B — Move selected items / quantities from the source order
 * (`:id` in the route) onto an existing open target order in the same
 * branch. Differs from split-items in that the destination already
 * exists. KDS tickets are not auto-republished.
 */
export class MoveOrderItemsDto {
    @IsString()
    targetOrderId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => MoveOrderItemSelectionDto)
    items!: MoveOrderItemSelectionDto[];

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
