import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    MaxLength,
} from 'class-validator';

/** POST /api/auth/invitations/accept */
export class AcceptInvitationDto {
    @IsString()
    @IsNotEmpty()
    invitationToken!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    firstName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    lastName?: string;
}

/** POST /api/auth/forgot-password */
export class ForgotPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;
}

/** POST /api/auth/reset-password */
export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    resetToken!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;
}

/** POST /api/auth/force-password-change (authenticated) */
export class ForcePasswordChangeDto {
    @IsString()
    @IsNotEmpty()
    currentPassword!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;
}
