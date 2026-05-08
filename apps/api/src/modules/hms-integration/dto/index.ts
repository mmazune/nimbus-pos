import { IsInt, IsOptional, IsString, Max, Min, IsIn, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class HmsPaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 50;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0;

    @IsOptional()
    @IsISO8601()
    from?: string;

    @IsOptional()
    @IsISO8601()
    to?: string;

    @IsOptional()
    @IsString()
    branchId?: string;
}

export class HmsListOrdersDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    serviceType?: string;
}

export class HmsListPaymentsDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    method?: string;

    @IsOptional()
    @IsString()
    status?: string;
}

export class HmsListReservationsDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    status?: string;
}

export class HmsListEventsDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    status?: string;
}

export class HmsListInventoryDto extends HmsPaginationDto {
    @IsOptional()
    @IsIn(['true', 'false'])
    lowStockOnly?: string;
}

export class HmsListMenuDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    categoryId?: string;
}

export class HmsListShiftsDto extends HmsPaginationDto {
    @IsOptional()
    @IsString()
    status?: string;
}

export class HmsListAccessLogsDto extends HmsPaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    statusCode?: number;
}
