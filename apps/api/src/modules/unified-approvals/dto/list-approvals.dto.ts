import { Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsInt,
    IsISO8601,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';
import { ApprovalSourceType } from '../approval-source.types';

export type ApprovalListStatus = 'PENDING' | 'DECIDED' | 'ALL';

const SOURCE_TYPES: ApprovalSourceType[] = [
    'discount',
    'refund',
    'leave_request',
    'shift_swap',
    'vendor_bill',
    'inter_branch_transfer',
];

export class ListApprovalsDto {
    @IsOptional()
    @IsEnum(['PENDING', 'DECIDED', 'ALL'])
    status?: ApprovalListStatus;

    /** Single source type filter, e.g. ?sourceType=discount */
    @IsOptional()
    @IsEnum(SOURCE_TYPES as unknown as Record<string, string>)
    sourceType?: ApprovalSourceType;

    /** Optional CSV/array filter, e.g. ?domain=POS,HR */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Type(() => String)
    domain?: string[] | string;

    /** Override the branchId from the request context (must be one the user can access). */
    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsISO8601()
    dateFrom?: string;

    @IsOptional()
    @IsISO8601()
    dateTo?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize?: number;
}
