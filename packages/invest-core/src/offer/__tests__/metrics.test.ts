import { describe, expect, it } from 'vitest';
import { OfferStatuses } from '@webdevelop-pro/domain-types/offerTypes';
import {
  calculateOfferFundedPercent,
  calculateOfferMinimumInvestment,
  isOfferClosingSoon,
  isOfferFullyFunded,
  isOfferFundingCompleted,
  isOfferNewWithinDays,
  isOfferSharesReached,
  isRegD506cOffer,
} from '../metrics.ts';

describe('offer metrics', () => {
  it('uses existing funded-percent rounding behavior', () => {
    expect(calculateOfferFundedPercent('0', '0')).toBe(0);
    expect(calculateOfferFundedPercent('421', '1000')).toBe(43);
    expect(calculateOfferFundedPercent('856', '1000')).toBe(85);
    expect(calculateOfferFundedPercent('999', '1000')).toBe(99);
  });

  it('derives funding progress booleans', () => {
    expect(isOfferFullyFunded(100)).toBe(true);
    expect(isOfferFullyFunded(99)).toBe(false);
    expect(isOfferClosingSoon(91)).toBe(true);
    expect(isOfferClosingSoon(100)).toBe(false);
  });

  it('calculates minimum investment and remaining-share cutoff', () => {
    expect(calculateOfferMinimumInvestment('25', '12')).toBe('25');
    expect(calculateOfferMinimumInvestment('0', '12')).toBe('0');
    expect(isOfferSharesReached('100', '96', '50', '12')).toBe(true);
    expect(isOfferSharesReached('100', '95', '50', '12')).toBe(false);
    expect(isOfferSharesReached('0', '99999999999999999999', '1')).toBe(false);
  });

  it('keeps fractional and unsafe share values exact', () => {
    expect(calculateOfferFundedPercent(
      '9007199254740992.000000000000000001',
      '18014398509481984.000000000000000002',
    )).toBe(50);
    expect(calculateOfferMinimumInvestment('2000.000000000000000001', '12.5'))
      .toBe('2000.000000000000000001');
    expect(isOfferSharesReached(
      '9007199254740993.000000000000000001',
      '9007199254740992.999999999999999999',
      '0.000000000000000026',
      '12.5',
    )).toBe(true);
  });

  it('detects new and Reg D 506(c) offers', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');

    expect(isOfferNewWithinDays('2026-04-09T12:00:00.000Z', 2, now)).toBe(true);
    expect(isOfferNewWithinDays('2026-04-07T11:59:00.000Z', 2, now)).toBe(false);
    expect(isOfferNewWithinDays('', 2, now)).toBe(false);
    expect(isRegD506cOffer('Reg D 506(c)')).toBe(true);
    expect(isRegD506cOffer('Reg CF')).toBe(false);
  });

  it('detects completed funding statuses', () => {
    expect(isOfferFundingCompleted(OfferStatuses.legal_closed)).toBe(true);
    expect(isOfferFundingCompleted(OfferStatuses.closed_successfully)).toBe(true);
    expect(isOfferFundingCompleted(OfferStatuses.published)).toBe(false);
  });
});
