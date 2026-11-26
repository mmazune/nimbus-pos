import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy, ValidationOptions } from 'class-validator';
import { Decimal } from '@prisma/client/runtime/library';

/** A decimal with at most 10 whole digits and 2 decimals, written as a string. */
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * E1F (S6): money is a decimal string from the request onwards, never a JS number.
 * A JSON number is still accepted for callers that send one today: it is turned into its
 * shortest exact string before validation, and the range is checked as a Decimal. Anything
 * with more than two decimals, more than ten whole digits, or outside [min, max] is a 400.
 */
export function IsMoney(
  opts: { min: string; max: string },
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'number' && Number.isFinite(value) ? String(value) : value,
    ),
    ValidateBy(
      {
        name: 'isMoney',
        validator: {
          validate: (value: unknown) => {
            if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) return false;
            const d = new Decimal(value);
            return d.gte(opts.min) && d.lte(opts.max);
          },
          defaultMessage: (args) =>
            `${args?.property ?? 'amount'} must be an amount from ${opts.min} to ${opts.max} with at most 2 decimals`,
        },
      },
      validationOptions,
    ),
  );
}
