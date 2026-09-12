import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { InvestRuntimeAdapters } from '../adapters.ts';
import { resolveInvestRuntimePrivateCachePartition } from '../adapters.ts';

const storeMocks = vi.hoisted(() => ({
  persistOfflineResponse: vi.fn().mockResolvedValue(undefined),
  readOfflineResponse: vi.fn().mockResolvedValue(null),
  readOfflineResponseMetadata: vi.fn().mockResolvedValue(null),
}));

vi.mock('../pwa/pwaOfflineStore.ts', () => ({
  PWA_OFFLINE_LAST_SYNC_HEADER: 'x-last-sync',
  PWA_OFFLINE_RESPONSE_SOURCE_HEADER: 'x-source',
  ...storeMocks,
}));

vi.mock('../error/errorReporting.ts', () => ({ reportError: vi.fn() }));

import { createDefaultApiClientHooks } from '../apiClientDefaultHooks.ts';

const privatePolicy = {
  key: 'wallet-api',
  scope: 'private',
  persistToIndexedDb: true,
};
const publicPolicy = {
  key: 'offer-api',
  scope: 'public',
  persistToIndexedDb: true,
};
const requestUrl = 'https://api.example.test/auth/wallet';

describe('default API-client offline partition plumbing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the current session/profile partition to private reads and writes', async () => {
    let session = 'session-one';
    let profile = '7';
    const adapters: InvestRuntimeAdapters = {
      auth: {
        getSession: async () => null,
        getCachePartition: () => session,
      },
      profiles: {
        init: () => {},
        getUserProfiles: () => [],
        getSelectedUserProfileId: () => profile,
        setSelectedUserProfileById: () => {},
        resetSelectedProfile: () => {},
        resetProfileData: () => {},
        loadUserProfiles: () => {},
      },
    };
    const hooks = createDefaultApiClientHooks({
      getPrivateCachePartition: () => resolveInvestRuntimePrivateCachePartition(adapters),
    });

    await hooks.readOfflineResponse(privatePolicy, requestUrl);
    await hooks.persistOfflineResponse(privatePolicy, requestUrl, {
      data: {},
      status: 200,
      headers: new Headers(),
      payloadType: 'json',
      updatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect(storeMocks.readOfflineResponse).toHaveBeenCalledWith(
      privatePolicy,
      requestUrl,
      'session-one:profile:7',
    );
    expect(storeMocks.persistOfflineResponse).toHaveBeenCalledWith(
      privatePolicy,
      requestUrl,
      expect.any(Object),
      'session-one:profile:7',
    );

    session = 'session-two';
    profile = '9';
    await hooks.readOfflineResponse(privatePolicy, requestUrl);
    expect(storeMocks.readOfflineResponse).toHaveBeenLastCalledWith(
      privatePolicy,
      requestUrl,
      'session-two:profile:9',
    );
  });

  it('does not touch private storage without an authenticated partition', async () => {
    const hooks = createDefaultApiClientHooks({ getPrivateCachePartition: () => null });

    await expect(hooks.readOfflineResponse(privatePolicy, requestUrl)).resolves.toBeNull();
    await hooks.persistOfflineResponse(privatePolicy, requestUrl, {
      data: {},
      status: 200,
      headers: new Headers(),
      payloadType: 'json',
      updatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect(storeMocks.readOfflineResponse).not.toHaveBeenCalled();
    expect(storeMocks.persistOfflineResponse).not.toHaveBeenCalled();
  });

  it('continues to cache public policies without a private identity', async () => {
    const hooks = createDefaultApiClientHooks({ getPrivateCachePartition: () => null });

    await hooks.readOfflineResponse(publicPolicy, 'https://api.example.test/public/offer');
    expect(storeMocks.readOfflineResponse).toHaveBeenCalledWith(
      publicPolicy,
      'https://api.example.test/public/offer',
      undefined,
    );
  });
});
