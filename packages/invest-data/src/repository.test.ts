import { describe, expect, it } from 'vitest';
import { createInitialActionState, withOfflineHydrationMeta } from './repository.ts';

describe('withOfflineHydrationMeta', () => {
  it('applies offline provenance and sync time without changing action data', () => {
    const state = createInitialActionState({ id: 42 });
    const headers = new Headers({
      'x-invest-offline-source': 'offline-cache',
      'x-invest-offline-last-synced-at': '2026-07-18T18:00:00.000Z',
    });

    expect(withOfflineHydrationMeta(state, headers)).toEqual({
      ...state,
      dataSource: 'offline-cache',
      lastSyncedAt: '2026-07-18T18:00:00.000Z',
    });
  });

  it('preserves identity when transport metadata is absent', () => {
    const state = createInitialActionState('cached');

    expect(withOfflineHydrationMeta(state, new Headers())).toBe(state);
  });
});
