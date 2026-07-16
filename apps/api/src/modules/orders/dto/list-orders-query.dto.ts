import { IsOptional, IsString, IsEnum, IsInt, Min, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const ORDER_STATUSES = [
  'NEW',
  'SENT',
  'IN_KITCHEN',
  'READY',
  'SERVED',
  'VOIDED',
  'CLOSED',
] as const;

export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(ORDER_STATUSES)
  status?: string;

  @IsOptional()
  @IsEnum(['DINE_IN', 'TAKEAWAY'])
  serviceType?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  /**
   * Filter orders by owning user.
   * Special value `me` resolves to the authenticated user id in the controller.
   * (Waiter MVP: enables the "Mine" filter on the Orders tab.)
   */
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * Exclude one or more order statuses from the result set.
   * Waiter MVP uses `excludeStatus=NEW` to hide drafts from the queue.
   * Accepts repeated query params (`?excludeStatus=NEW&excludeStatus=VOIDED`)
   * or a comma-separated string (`?excludeStatus=NEW,VOIDED`).
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return value;
  })
  @IsArray()
  @IsEnum(ORDER_STATUSES, { each: true })
  excludeStatus?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
