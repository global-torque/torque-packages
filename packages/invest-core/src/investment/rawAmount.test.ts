import { describe, expect, it } from 'vitest';
import {
  compareRawAmounts,
  decimalAmountToRaw,
  formatRawAmount,
  formatSignedRawAmount,
} from './rawAmount.ts';

describe('raw token amount helpers', () => {
  it('converts fractional shares without floating-point arithmetic', () => {
    expect(decimalAmountToRaw('0.25', 18)).toBe('250000000000000000');
    expect(decimalAmountToRaw('125.5000000000000000001', 18)).toBeNull();
    expect(decimalAmountToRaw('1e3', 18)).toBeNull();
  });

  it('compares and formats exact integer raw values', () => {
    expect(compareRawAmounts('250000000000000000', '1000000000000000000')).toBe(-1);
    expect(compareRawAmounts('01', '1')).toBeNull();
    expect(formatRawAmount('250000000000000000', 18)).toBe('0.25');
    expect(formatRawAmount('6250000', 6)).toBe('6.25');
    expect(formatSignedRawAmount('-2000000', 6)).toBe('-2');
  });
});
