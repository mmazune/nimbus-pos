import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderItemVoidReason } from '@prisma/client';

export class VoidOrderItemDto {
  @IsEnum(OrderItemVoidReason, {
    message: `reason must be one of ${Object.values(OrderItemVoidReason).join(', ')}`,
  })
  reason!: OrderItemVoidReason;

  /** Required when the reason is OTHER. */
  @ValidateIf((o) => o.reason === OrderItemVoidReason.OTHER || o.note !== undefined)
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Whether the kitchen or bar had already made it. Required: it decides what is waste. */
  @IsBoolean()
  wasMade!: boolean;

  /** Void only part of the line (splits it in two). Omit to void the whole line. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
