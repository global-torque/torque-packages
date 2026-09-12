import { describe, expect, it } from 'vitest';
import {
  assertCanonicalDecimalString,
  assertPositiveCanonicalDecimalString,
  canonicalDecimalToScaled,
  compareCanonicalDecimals,
  formatCanonicalDecimal,
  formatCanonicalUsd,
  formatExactUsd,
  isCanonicalDecimalString,
  multiplyCanonicalDecimals,
  scaledToCanonicalDecimal,
} from '../canonicalDecimal.ts';

describe('canonical decimals', () => {
  it('accepts only the numeric(38,18) canonical JSON string contract', () => {
    expect(isCanonicalDecimalString('0')).toBe(true);
    expect(isCanonicalDecimalString('99999999999999999999.999999999999999999')).toBe(true);
    expect(isCanonicalDecimalString('0.000000000000000001')).toBe(true);

    for (const invalid of [0, '00', '01', '1.0', '1.', '.1', '-1', '+1', '1e2',
      '100000000000000000000', '0.0000000000000000001']) {
      expect(isCanonicalDecimalString(invalid)).toBe(false);
    }
  });

  it('rejects numeric tokens rather than coercing them', () => {
    expect(() => assertCanonicalDecimalString(1, 'number_of_shares'))
      .toThrow('number_of_shares must be a canonical decimal string');
  });

  it('enforces positive business values separately from the zero-capable wire format', () => {
    expect(() => assertPositiveCanonicalDecimalString('0', 'number_of_shares'))
      .toThrow('number_of_shares must be greater than zero');
    expect(() => assertPositiveCanonicalDecimalString(1, 'number_of_shares'))
      .toThrow('number_of_shares must be a canonical decimal string');
    expect(() => assertPositiveCanonicalDecimalString('0.000000000000000001'))
      .not.toThrow();
  });

  it('converts and compares values without IEEE-754 precision loss', () => {
    const maximum = '99999999999999999999.999999999999999999';
    expect(scaledToCanonicalDecimal(canonicalDecimalToScaled(maximum))).toBe(maximum);
    expect(compareCanonicalDecimals('9007199254740993', '9007199254740992.999999999999999999')).toBe(1);
  });

  it('multiplies and formats through scaled integers', () => {
    expect(multiplyCanonicalDecimals('12.5', '2000.000000000000000001'))
      .toBe('25000.0000000000000000125');
    expect(formatExactUsd(multiplyCanonicalDecimals('0.005', '1'), 2)).toBe('$0.01');
    expect(multiplyCanonicalDecimals(
      '99999999999999999999.999999999999999999',
      '99999999999999999999.999999999999999999',
    )).toBe('9999999999999999999999999999999999999800.000000000000000000000000000000000001');
    expect(formatCanonicalDecimal('9007199254740993.125')).toBe('9,007,199,254,740,993.125');
    expect(formatCanonicalUsd('9007199254740993.125')).toBe('$9,007,199,254,740,993.13');
  });
});
