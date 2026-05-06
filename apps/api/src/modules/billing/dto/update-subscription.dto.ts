import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSubscriptionDto {
    @IsOptional()
    @IsString()
    planCode?: string;

    @IsOptional()
    @IsEnum(['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'])
    status?: string;

    @IsOptional()
    @IsEnum(['MONTHLY', 'QUARTERLY', 'ANNUAL'])
    billingCycle?: string;

    @IsOptional()
    @IsString()
    cancelReason?: string;
}
