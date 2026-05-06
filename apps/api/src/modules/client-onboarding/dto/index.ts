import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray } from 'class-validator';

export class CreateOnboardingOrgDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    slug!: string;

    @IsString()
    @IsOptional()
    legalName?: string;

    @IsString()
    @IsOptional()
    taxId?: string;
}

export class CreateOnboardingBranchDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    phone?: string;
}

export class UpdateBusinessProfileDto {
    @IsString()
    @IsOptional()
    cuisineType?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    website?: string;
}

export class UpdateOnboardingSettingsDto {
    @IsString()
    @IsOptional()
    currency?: string;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    language?: string;
}

export class OnboardingInvitationDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    roleName!: string;

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;
}

export class CreateOnboardingInvitationsDto {
    @IsArray()
    invitations!: OnboardingInvitationDto[];
}

/** PATCH /api/onboarding/invitations/:id/revoke */
export class RevokeInvitationDto {
    @IsString()
    @IsOptional()
    reason?: string;
}
