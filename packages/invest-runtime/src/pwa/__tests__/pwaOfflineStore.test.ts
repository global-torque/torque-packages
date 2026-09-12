import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ResolvedOfflineDomainPolicy } from '../pwaPolicy.ts';
import {
  clearOfflineResponsesByScope,
  clearPrivateRuntimeCaches,
  readOfflineResponse,
} from '../pwaOfflineStore.ts';

const policy = {
  key: 'wallet',
  scope: 'private',
  persistToIndexedDb: true,
} as ResolvedOfflineDomainPolicy;

describe('offline response store failures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('propagates an IndexedDB open failure for sanitized runtime reporting', async () => {
    const openError = new Error('indexed database unavailable');
    const indexedDB = {
      open: vi.fn(() => {
        const request: {
          error: Error;
          onerror?: () => void;
          onsuccess?: () => void;
          onupgradeneeded?: () => void;
        } = { error: openError };
        queueMicrotask(() => request.onerror?.());
        return request as unknown as IDBOpenDBRequest;
      }),
    };
    vi.stubGlobal('window', { indexedDB });

    await expect(readOfflineResponse(
      policy,
      'https://api.example.test/auth/wallet',
      'session-one:profile-7',
    ))
      .rejects
      .toBe(openError);
  });

  it('deletes current and retired private CacheStorage entries but keeps public caches', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([
        'wallet-api-cache-v1',
        'investment-api-cache-v2',
        'evm-api-cache-v3',
        'offer-api-cache-v3',
      ]),
      delete: deleteCache,
    });

    await clearPrivateRuntimeCaches();

    expect(deleteCache.mock.calls.map(([cacheName]) => cacheName)).toEqual([
      'wallet-api-cache-v1',
      'investment-api-cache-v2',
      'evm-api-cache-v3',
    ]);
  });

  it('observes a transaction that completes while its request handler resumes', async () => {
    const transaction = {
      error: null,
      onabort: null as (() => void) | null,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      objectStore: vi.fn(),
    };
    const getAllRequest = {
      error: null,
      result: [],
      onerror: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
    };
    const store = {
      index: vi.fn(() => ({
        getAll: vi.fn(() => {
          queueMicrotask(() => {
            getAllRequest.onsuccess?.();
            transaction.oncomplete?.();
          });
          return getAllRequest;
        }),
      })),
    };
    transaction.objectStore.mockReturnValue(store);
    const database = {
      close: vi.fn(),
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => transaction),
    };
    const openRequest = {
      error: null,
      result: database,
      onerror: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    };
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      indexedDB: {
        open: vi.fn(() => {
          queueMicrotask(() => openRequest.onsuccess?.());
          return openRequest;
        }),
      },
    });

    await expect(clearOfflineResponsesByScope('private')).resolves.toBeUndefined();
    expect(database.close).toHaveBeenCalledOnce();
  });
});
