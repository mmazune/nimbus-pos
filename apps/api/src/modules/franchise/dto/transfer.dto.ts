import { IsString, IsOptional, IsEnum, IsNotEmpty, IsDecimal } from 'class-validator';

export enum InterBranchTransferTypeDto {
    STOCK = 'STOCK',
    VALUE = 'VALUE',
}

export enum TransferUrgencyDto {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export class CreateTransferDto {
    @IsString()
    @IsNotEmpty()
    fromBranchId!: string;

    @IsString()
    @IsNotEmpty()
    toBranchId!: string;

    @IsOptional()
    @IsEnum(InterBranchTransferTypeDto)
    transferType?: InterBranchTransferTypeDto;

    @IsOptional()
    @IsEnum(TransferUrgencyDto)
    urgency?: TransferUrgencyDto;

    @IsOptional()
    @IsString()
    inventoryItemId?: string;

    @IsOptional()
    @IsString()
    itemCategory?: string;

    @IsOptional()
    @IsDecimal()
    quantity?: string;

    @IsOptional()
    @IsDecimal()
    estimatedValue?: string;

    @IsString()
    @IsNotEmpty()
    rationale!: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateTransferStatusDto {
    @IsString()
    @IsNotEmpty()
    @IsEnum({
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
        IN_TRANSIT: 'IN_TRANSIT',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'CANCELLED',
    })
    status!: string;

    @IsOptional()
    @IsString()
    rejectionReason?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
