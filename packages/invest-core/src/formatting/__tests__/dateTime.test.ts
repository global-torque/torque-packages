import { describe, expect, it } from 'vitest';
import {
  formatLocalHoursMinutes,
  formatToFullDate,
  formatToShortMonthDateYear,
} from '../dateTime.ts';

describe('date/time formatting', () => {
  it('formats full numeric dates with the existing en-US formatter', () => {
    expect(formatToFullDate(new Date(2026, 3, 8))).toBe('4/8/2026');
    expect(formatToFullDate('not-a-date')).toBe('-');
    expect(formatToFullDate(undefined)).toBe('-');
    expect(formatToFullDate(undefined, '')).toBe('');
  });

  it('formats short month dates for profile display', () => {
    expect(formatToShortMonthDateYear(new Date(2026, 3, 8))).toBe('Apr 8, 2026');
  });

  it('formats local time as unpadded hours and padded minutes', () => {
    expect(formatLocalHoursMinutes(new Date(2026, 3, 8, 9, 5))).toBe('9:05');
    expect(formatLocalHoursMinutes(new Date(2026, 3, 8, 17, 0))).toBe('17:00');
  });
});
