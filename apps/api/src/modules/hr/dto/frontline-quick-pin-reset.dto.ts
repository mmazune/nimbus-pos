import { IsOptional, IsString } from 'class-validator';

/**
 * BG1.1 — Body for POST /api/hr/frontline-staff/:id/quick-pin/reset.
 * `branchId` is optional — when omitted the service falls back to the
 * employee's home branch and finally to the active branch context header.
 */
export class FrontlineQuickPinResetDto {
    @IsString()
    @IsOptional()
    branchId?: string;
}
