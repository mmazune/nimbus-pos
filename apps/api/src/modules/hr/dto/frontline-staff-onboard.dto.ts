import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsBoolean,
    IsDateString,
    IsEnum,
    Matches,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentType } from '@prisma/client';

export class FrontlineStaffOnboardEmployeePartDto {
    @IsString()
    @IsOptional()
    @MaxLength(50)
    employeeCode?: string;

    @IsDateString()
    hireDate!: string;

    @IsEnum(EmploymentType)
    employmentType!: EmploymentType;

    @IsString()
    @IsOptional()
    positionId?: string;

    @IsString()
    @IsOptional()
    contractId?: string;

    @IsString()
    @IsOptional()
    compensationProfileId?: string;
}

/**
 * BG1 / BG1.1 — POST /api/hr/frontline-staff/onboard
 *
 * BG1.1 PIN-first refinement:
 *   - phone is now REQUIRED (frontline identity = name + phone).
 *   - email is OPTIONAL — when omitted the service synthesises an internal
 *     `pin-{cuid}@nimbus.pin.local` address so the underlying User row stays
 *     unique without exposing a fake email to staff.
 *   - issueQuickPin defaults to TRUE for frontline JobRoles.
 *   - enablePasswordLogin defaults to FALSE; temporaryPassword is only
 *     required (and only honoured) when password login is explicitly enabled.
 *   - When PIN-only, the User is created with an unguessable random password
 *     and mustChangePassword stays FALSE (no password to rotate).
 */
export class FrontlineStaffOnboardDto {
    /** Optional for PIN-first frontline staff. Required when enablePasswordLogin=true. */
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    lastName!: string;

    /** BG1.1 — phone is the primary frontline identity contact. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    @Matches(/^[0-9+()\-\s]{6,30}$/, {
        message: 'phone must be a valid phone number',
    })
    phone!: string;

    /** Role NAME — e.g. "Cashier", "Waiter", "Chef", "Bartender", "Stock Manager", "Supervisor". */
    @IsString()
    @IsNotEmpty()
    roleName!: string;

    /**
     * BG1.1 — defaults to TRUE for frontline JobRoles (CASHIER / WAITER / CHEF
     * / BARTENDER / STOCK_MANAGER / SUPERVISOR / MANAGER). Set to false to
     * skip PIN issuance at create time (manager can issue later via the
     * /quick-pin/reset endpoint).
     */
    @IsBoolean()
    @IsOptional()
    issueQuickPin?: boolean;

    /**
     * BG1.1 — when TRUE the user can ALSO log in via email + password
     * (`/api/auth/login`). Default FALSE for PIN-first frontline workflow.
     * If TRUE, `email` and `temporaryPassword` are required.
     */
    @IsBoolean()
    @IsOptional()
    enablePasswordLogin?: boolean;

    /**
     * Initial password — REQUIRED when enablePasswordLogin=true, IGNORED
     * otherwise. When honoured, the user is flagged mustChangePassword=true
     * automatically so they rotate it on first login.
     */
    @IsString()
    @IsOptional()
    @MinLength(8)
    @MaxLength(128)
    temporaryPassword?: string;

    @ValidateNested()
    @Type(() => FrontlineStaffOnboardEmployeePartDto)
    employee!: FrontlineStaffOnboardEmployeePartDto;
}
