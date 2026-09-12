import { describe, expect, it } from 'vitest';
import { isOfflineRecordExpired } from './pwaOfflineStore.ts';

describe('offline response expiry', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');

  it('expires records older than maxAgeSeconds and malformed timestamps', () => {
    expect(isOfflineRecordExpired('2026-07-22T10:00:00Z', 3600, now)).toBe(true);
    expect(isOfflineRecordExpired('invalid', 3600, now)).toBe(true);
  });

  it('keeps fresh records and policies without an explicit maximum age', () => {
    expect(isOfflineRecordExpired('2026-07-22T11:30:00Z', 3600, now)).toBe(false);
    expect(isOfflineRecordExpired('2020-01-01T00:00:00Z', undefined, now)).toBe(false);
  });
});
