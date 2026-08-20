import { IsOptional, IsString } from 'class-validator';

/**
 * BG1.1 — Body for POST /api/hr/frontline-staff/:id/quick-pin/reset.
 *
 * `branchId` is optional and, since B3-F1 (2026-08-20), may only restate the active
 * `X-Branch-Id` context. Any other value is rejected with 400 rather than honoured:
 * the value feeds the Quick PIN lookup hash, so accepting a foreign branch would mint
 * a PIN scoped to a branch the caller is not acting in. When omitted the service uses
 * the employee's home branch, which the branch guard has already proven equals the
 * active branch context.
 */
export class FrontlineQuickPinResetDto {
    @IsString()
    @IsOptional()
    branchId?: string;
}
