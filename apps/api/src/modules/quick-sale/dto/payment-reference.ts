import { registerDecorator, ValidationOptions } from 'class-validator';

/** Luhn check over a string of digits. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * True when the value could be a payment card number: with dots and dashes removed it is
 * 13 to 19 digits and passes the Luhn check (H1F2, S-2).
 */
export function looksLikeCardDigits(value: string): boolean {
  const digits = value.replace(/[.-]/g, '');
  return /^\d{13,19}$/.test(digits) && passesLuhn(digits);
}

/** A mobile-money transaction reference: letters, digits, dots and dashes, at most 32. */
export const MOBILE_MONEY_REFERENCE_PATTERN = /^[A-Za-z0-9.-]{1,32}$/;

/**
 * Validates a mobile-money transaction reference. The message is fixed text: it never echoes
 * the value, so a refused card number is not repeated in the response or in a log line.
 */
export function IsMobileMoneyReference(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isMobileMoneyReference',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'externalTransactionId must be 1 to 32 letters, digits, dots or dashes, and must not be a card number',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          MOBILE_MONEY_REFERENCE_PATTERN.test(value) &&
          !looksLikeCardDigits(value),
      },
    });
}
