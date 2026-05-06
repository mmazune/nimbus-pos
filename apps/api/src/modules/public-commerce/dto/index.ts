import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsNumber, IsDateString, IsEmail, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── Merchant-side DTOs ──

export class UpdatePublicProfileDto {
    @IsString() @IsOptional() displayName?: string;
    @IsString() @IsOptional() description?: string;
    @IsString() @IsOptional() cuisineType?: string;
    @IsString() @IsOptional() address?: string;
    @IsString() @IsOptional() phone?: string;
    @IsString() @IsOptional() email?: string;
    @IsString() @IsOptional() logoUrl?: string;
    @IsString() @IsOptional() coverImageUrl?: string;
    @IsOptional() openingHours?: Record<string, unknown>;
}

export class CreatePublicEventDto {
    @IsString() @IsNotEmpty() title!: string;
    @IsString() @IsOptional() description?: string;
    @IsDateString() startsAt!: string;
    @IsDateString() @IsOptional() endsAt?: string;
    @IsInt() @Min(0) @Type(() => Number) capacity!: number;
    @IsString() @IsOptional() priceAmount?: string;
    @IsString() @IsOptional() priceCurrency?: string;
    @IsBoolean() @IsOptional() isFree?: boolean;
    @IsString() @IsOptional() imageUrl?: string;
}

export class UpdatePublicEventDto {
    @IsString() @IsOptional() title?: string;
    @IsString() @IsOptional() description?: string;
    @IsDateString() @IsOptional() startsAt?: string;
    @IsDateString() @IsOptional() endsAt?: string;
    @IsString() @IsOptional() imageUrl?: string;
}

export class UpdateEventCapacityDto {
    @IsInt() @Min(0) @Type(() => Number) capacity!: number;
}

export class UpdateEventPricingDto {
    @IsString() @IsOptional() priceAmount?: string;
    @IsString() @IsOptional() priceCurrency?: string;
    @IsBoolean() @IsOptional() isFree?: boolean;
}

export class UpdateBookingSettingsDto {
    @IsOptional() settings?: Record<string, unknown>;
}

// ── Public-side DTOs ──

export class HoldReservationDto {
    @IsString() @IsNotEmpty() restaurantSlug!: string;
    @IsString() @IsNotEmpty() guestName!: string;
    @IsEmail() @IsOptional() guestEmail?: string;
    @IsString() @IsOptional() guestPhone?: string;
    @IsInt() @Min(1) @Type(() => Number) partySize!: number;
    @IsDateString() requestedDate!: string;
    @IsString() @IsNotEmpty() requestedTime!: string;
    @IsString() @IsOptional() notes?: string;
}

export class ConfirmReservationDto {
    @IsString() @IsNotEmpty() holdId!: string;
}

export class HoldEventBookingDto {
    @IsString() @IsNotEmpty() eventSlug!: string;
    @IsString() @IsNotEmpty() guestName!: string;
    @IsEmail() @IsOptional() guestEmail?: string;
    @IsString() @IsOptional() guestPhone?: string;
    @IsInt() @Min(1) @Type(() => Number) @IsOptional() ticketCount?: number;
    @IsString() @IsOptional() notes?: string;
}

export class ConfirmEventBookingDto {
    @IsString() @IsNotEmpty() holdId!: string;
}
