import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * Public commerce payment readiness — declarative configuration only.
 *
 * NOTE: This module is NOT a live PesaPal integration for diner payments.
 * It tracks the restaurant's readiness to accept future public/diner mobile-money
 * payments (MTN / Airtel). Until that integration is finalised, this module is
 * effectively a configuration record + audit trail.
 */
export type MerchantPaymentReadiness =
    | 'NOT_CONFIGURED'
    | 'PENDING_MTN'
    | 'PENDING_AIRTEL'
    | 'READY_FOR_INTEGRATION'
    | 'LIVE'
    | 'DISABLED';

export class ConnectMerchantPaymentDto {
    /**
     * Free-text note about what the merchant is requesting.
     * Optional.
     */
    @IsString()
    @IsOptional()
    notes?: string;

    /**
     * Optional declared readiness target (e.g. "PENDING_MTN", "PENDING_AIRTEL").
     * Defaults to PENDING_MTN.
     */
    @IsString()
    @IsOptional()
    @IsIn(['PENDING_MTN', 'PENDING_AIRTEL', 'READY_FOR_INTEGRATION'])
    readiness?: 'PENDING_MTN' | 'PENDING_AIRTEL' | 'READY_FOR_INTEGRATION';
}

export class UpdateMerchantPaymentConfigDto {
    @IsString()
    @IsOptional()
    notes?: string;

    /**
     * Operator-controlled readiness state. The set of accepted values is
     * deliberately narrow — moving to LIVE requires the mobile-money
     * integration to be wired by a Nimbus engineer.
     */
    @IsString()
    @IsOptional()
    @IsIn([
        'NOT_CONFIGURED',
        'PENDING_MTN',
        'PENDING_AIRTEL',
        'READY_FOR_INTEGRATION',
        'LIVE',
        'DISABLED',
    ])
    readiness?: MerchantPaymentReadiness;
}
