import { IsString, IsInt, IsIn, Min } from 'class-validator';

/**
 * Update the org's rounding policy.
 * Shape: { mode: "NEAREST"|"UP"|"DOWN", increment: number }
 */
export class UpdateRoundingDto {
  @IsString()
  @IsIn(['NEAREST', 'UP', 'DOWN'])
  mode!: string;

  @IsInt()
  @Min(1)
  increment!: number;
}
