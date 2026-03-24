import {
  IsInt,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'slaOrder', async: false })
class SlaOrderConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as UpdateKdsSlaDto;
    return obj.greenSeconds <= obj.amberSeconds && obj.amberSeconds <= obj.redSeconds;
  }
  defaultMessage(): string {
    return 'SLA thresholds must satisfy greenSeconds <= amberSeconds <= redSeconds';
  }
}

export class UpdateKdsSlaDto {
  @IsInt()
  @Min(1)
  greenSeconds!: number;

  @IsInt()
  @Min(1)
  @Validate(SlaOrderConstraint)
  amberSeconds!: number;

  @IsInt()
  @Min(1)
  @Validate(SlaOrderConstraint)
  redSeconds!: number;
}
