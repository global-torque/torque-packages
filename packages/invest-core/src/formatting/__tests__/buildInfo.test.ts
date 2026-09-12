import { describe, expect, it } from 'vitest';
import { formatBuildDisplay, formatBuildTimestamp } from '../buildInfo.ts';

describe('buildInfo', () => {
  it('formats build timestamps in a stable UTC label', () => {
    expect(formatBuildTimestamp('2026-04-03T12:34:56.000Z')).toBe('Apr 3, 2026, 12:34 PM UTC');
  });

  it('falls back to the raw timestamp when parsing fails', () => {
    expect(formatBuildTimestamp('custom-build-time')).toBe('custom-build-time');
  });

  it('formats commit labels with optional build details', () => {
    expect(formatBuildDisplay('Commit: ', 'abc123', '2026-04-03T12:34:56.000Z'))
      .toBe('Commit: abc123 (built at Apr 3, 2026, 12:34 PM UTC)');
    expect(formatBuildDisplay('Commit: ', 'abc123')).toBe('Commit: abc123');
    expect(formatBuildDisplay('Commit: ', '', '2026-04-03T12:34:56.000Z')).toBe('');
  });
});
