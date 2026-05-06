import { IsEnum, IsOptional } from 'class-validator';

export class UsageQueryDto {
    @IsOptional()
    @IsEnum([
        'BRANCHES',
        'ACTIVE_USERS',
        'API_KEYS',
        'WEBHOOK_ENDPOINTS',
        'ORDERS_PROCESSED',
        'EVENTS_PROCESSED',
    ])
    metricType?: string;
}
