import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateApiKeyDto {
    @IsString()
    name!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    scopes?: string[];

    /**
     * BG7 — Optional branch restriction.
     *   - Omit / null  → org-wide key (sees ALL branches in the org)
     *   - Set           → key restricted to a single branch (HMS will only
     *                     see orders / payments / reservations / etc. for
     *                     this branch through `/api/hms/*`).
     */
    @IsOptional()
    @IsString()
    branchId?: string;
}
