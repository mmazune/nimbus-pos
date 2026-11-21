import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { looksLikeCardNumber, passesLuhn } from './payment-reference';
import { QuickSalePaymentDto } from './quick-sale.dto';

// 4111 1111 1111 1111 is the public Visa test number (Luhn-valid, never issued).
const LUHN_16 = ['4111', '1111', '1111', '1111'].join('');
const NOT_LUHN_16 = ['4111', '1111', '1111', '1112'].join('');

const check = async (over: Record<string, unknown>) => {
  const dto = plainToInstance(QuickSalePaymentDto, { method: 'MOMO', momoNetwork: 'MTN', ...over });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
};
const fieldErrors = (errs: Awaited<ReturnType<typeof check>>, field: string) =>
  errs.filter((e) => e.property === field);

describe('H1F2 S-2: no card number as a mobile-money reference', () => {
  it('Luhn: the Visa test number passes, one digit off does not', () => {
    expect(passesLuhn(LUHN_16)).toBe(true);
    expect(passesLuhn(NOT_LUHN_16)).toBe(false);
  });

  it.each([
    LUHN_16,
    '4111-1111-1111-1111',
    '4111.1111.1111.1111',
    '4111-1111.1111-1111',
    ['4111', '1111', '1111', '111'].join('') + '1', // 16 digits again, via concatenation
  ])('%s is refused (400) as externalTransactionId', async (ref) => {
    expect(looksLikeCardNumber(ref)).toBe(true);
    expect(fieldErrors(await check({ externalTransactionId: ref }), 'externalTransactionId')).toHaveLength(1);
  });

  it('the refusal message does not echo the value', async () => {
    const [e] = fieldErrors(await check({ externalTransactionId: LUHN_16 }), 'externalTransactionId');
    expect(JSON.stringify(e.constraints)).not.toContain('4111');
  });

  it.each([
    'MP240101123456', // 14 digits after MP: not all digits
    'MTN-REF-001',
    '12345678901', // 11 digits: shorter than a card
    NOT_LUHN_16, // 16 digits, not Luhn-valid: an ordinary reference
    '1234567890123456789012', // 22 digits: longer than any card
    'A'.repeat(32),
  ])('%s is accepted', async (ref) => {
    expect(fieldErrors(await check({ externalTransactionId: ref }), 'externalTransactionId')).toHaveLength(0);
  });

  it.each([
    'A'.repeat(33),
    'ref 123',
    'ref_123',
    'réf1',
    '',
  ])('%j is refused (characters or length)', async (ref) => {
    expect(fieldErrors(await check({ externalTransactionId: ref }), 'externalTransactionId')).toHaveLength(1);
  });

  it.each(['+256700000001', '0700 000 001', '256700000001', '+2567000000012', '700-000-001'])(
    'payerPhone %s is accepted (9 to 13 digits)',
    async (phone) => {
      expect(fieldErrors(await check({ payerPhone: phone }), 'payerPhone')).toHaveLength(0);
    },
  );

  it.each(['12345678', '12345678901234', LUHN_16, 'call me', '++256700000001'])(
    'payerPhone %s is refused',
    async (phone) => {
      expect(fieldErrors(await check({ payerPhone: phone }), 'payerPhone')).toHaveLength(1);
    },
  );
});
