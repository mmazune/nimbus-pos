import { IsString, Length, Matches } from 'class-validator';

/** T6 — the one-time setup token a manager's action made; never a PIN. */
export class PinSetupCheckDto {
  @IsString()
  @Matches(/^pst_[A-Za-z0-9_-]{16,64}$/)
  setupToken!: string;
}

/** T6 — the person types their own PIN twice on the device. */
export class PinSetupCompleteDto {
  @IsString()
  @Matches(/^pst_[A-Za-z0-9_-]{16,64}$/)
  setupToken!: string;

  @IsString()
  @Length(4, 12)
  pin!: string;

  @IsString()
  @Length(4, 12)
  pinConfirm!: string;
}
