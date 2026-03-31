import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateTaxLedgerConfigDto {
    @IsOptional()
    @IsString()
    outputTaxAccountId?: string;

    @IsOptional()
    @IsString()
    inputTaxAccountId?: string;

    @IsOptional()
    @IsString()
    discountAccountId?: string;

    @IsOptional()
    @IsString()
    depositLiabilityAccountId?: string;

    @IsOptional()
    @IsString()
    payrollPayableAccountId?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
