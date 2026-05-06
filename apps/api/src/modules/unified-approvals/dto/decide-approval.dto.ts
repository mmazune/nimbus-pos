import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type ApprovalDecision = 'APPROVE' | 'REJECT';

export class DecideApprovalDto {
    @IsEnum(['APPROVE', 'REJECT'])
    decision!: ApprovalDecision;

    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    reason?: string;

    /** Optional manager Quick PIN (forwarded to underlying service when supported). */
    @IsOptional()
    @IsString()
    @MinLength(4)
    @MaxLength(12)
    managerPin?: string;
}
