import { describe, expect, it } from 'vitest';
import {
  formatProfileDateToShortMonthDateYear,
  formatProfilePhoneNumberForDisplay,
  formatProfileUserPhoneNumber,
} from '../formatting.ts';

describe('profile formatting', () => {
  it('keeps the existing short month account-created date format', () => {
    expect(formatProfileDateToShortMonthDateYear(new Date(2026, 3, 8))).toBe('Apr 8, 2026');
  });

  it('formats user phone numbers only for 11-digit US numbers with a leading country code', () => {
    expect(formatProfileUserPhoneNumber('+1 (555) 123-4567')).toBe('+1 (555) 123 - 4567');
    expect(formatProfileUserPhoneNumber('5551234567')).toBeUndefined();
    expect(formatProfileUserPhoneNumber('+25551234567')).toBeUndefined();
  });

  it('formats profile detail phone numbers with optional country codes', () => {
    expect(formatProfilePhoneNumberForDisplay('+15551234567')).toBe('+1 (555) 123-4567');
    expect(formatProfilePhoneNumberForDisplay('5559876543')).toBe('(555) 987-6543');
    expect(formatProfilePhoneNumberForDisplay(undefined)).toBeUndefined();
  });
});
