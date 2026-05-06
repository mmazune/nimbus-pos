import { IsString, IsOptional, IsArray, IsEnum, IsUrl } from 'class-validator';

export class UpdateWebhookDto {
    @IsOptional()
    @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'url must be a valid HTTPS URL' })
    url?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(['ACTIVE', 'INACTIVE'])
    status?: string;

    @IsOptional()
    @IsArray()
    @IsEnum(
        [
            'ORDER_CREATED',
            'ORDER_CLOSED',
            'PAYMENT_RECEIVED',
            'REFUND_CREATED',
            'INVENTORY_LOW',
            'SHIFT_OPENED',
            'SHIFT_CLOSED',
            'RESERVATION_CREATED',
            'EVENT_BOOKED',
            'ANOMALY_DETECTED',
            'SUBSCRIPTION_CHANGED',
            'USAGE_LIMIT_APPROACHING',
        ],
        { each: true },
    )
    events?: string[];
}
