import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateReservationCheckoutDto {
    @IsString() @IsNotEmpty() holdId!: string;
    @IsString() @IsOptional() callbackUrl?: string;
}

export class CreateEventBookingCheckoutDto {
    @IsString() @IsNotEmpty() holdId!: string;
    @IsString() @IsOptional() callbackUrl?: string;
}

export class PublicPaymentReconcileDto {
    @IsString() @IsNotEmpty() orderTrackingId!: string;
}
