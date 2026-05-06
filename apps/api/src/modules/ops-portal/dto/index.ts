import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateOpsSupportSessionDto {
    @IsString() @IsNotEmpty() orgId!: string;
    @IsString() @IsNotEmpty() reason!: string;
    @IsString() @IsOptional() notes?: string;
}

export class CloseOpsSupportSessionDto {
    @IsString() @IsOptional() closedReason?: string;
}

export * from './plan-catalog.dto';
