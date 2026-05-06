import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ListTransfersQueryDto {
    @IsOptional()
    @IsString()
    fromBranchId?: string;

    @IsOptional()
    @IsString()
    toBranchId?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;
}
