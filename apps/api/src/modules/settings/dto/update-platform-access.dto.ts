import { IsBoolean, IsOptional, IsObject } from 'class-validator';

/**
 * Update platform access rules for the org.
 * Shape: { useRoleDefaults: boolean, overrides?: Record<string, string[]> }
 */
export class UpdatePlatformAccessDto {
  @IsBoolean()
  useRoleDefaults!: boolean;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, string[]>;
}
