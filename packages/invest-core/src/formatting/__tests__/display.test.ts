import { describe, expect, it } from 'vitest';
import {
  capitalizeFirstLetter,
  currency,
} from '../display.ts';

describe('display formatting', () => {
  it('formats USD currency with the default two fractional digits', () => {
    expect(currency(1234.5)).toBe('$1,234.50');
    expect(currency(0)).toBe('$0.00');
  });

  it('uses the provided minimum fractional digits when formatting currency', () => {
    expect(currency(12.5, 0)).toBe('$12.5');
    expect(currency(12, 0)).toBe('$12');
  });

  it('formats missing, invalid, infinite, and negative currency values as zero', () => {
    expect(currency(undefined)).toBe('$0.00');
    expect(currency(Number.NaN)).toBe('$0.00');
    expect(currency(Number.POSITIVE_INFINITY)).toBe('$0.00');
    expect(currency(-1)).toBe('$0.00');
  });

  it('capitalizes the first character without changing the rest of the string', () => {
    expect(capitalizeFirstLetter('wallet_update')).toBe('Wallet_update');
    expect(capitalizeFirstLetter('already Capitalized')).toBe('Already Capitalized');
    expect(capitalizeFirstLetter('')).toBe('');
  });
});
