import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateCheckoutSessionDto {
    @IsString()
    @IsNotEmpty()
    planCode!: string;

    @IsString()
    @IsNotEmpty()
    billingCycle!: string;

    @IsString()
    @IsOptional()
    callbackUrl?: string;
}

export class ReconcileStatusDto {
    @IsString()
    @IsNotEmpty()
    orderTrackingId!: string;
}
