import { describe, expect, it, vi } from 'vitest';
import { createRedemptionLifecycleClient, validateRedemptionLifecycleResponse } from '../redemptions.ts';
import { ApiClient } from '../service/apiClient.ts';
import { createApiClientHooks } from '../service/apiClientHooks.ts';

const item = (overrides: Record<string, unknown> = {}) => ({
  redemption_id: 1,
  offer_id: 2,
  vault_contract_id: 3,
  business_status: 'approved',
  protocol_state: 'unconfirmed',
  vault_status: 'request_available',
  vault_status_reason: 'request_preflight_passed',
  requested_assets_raw: '0', requested_shares_raw: '10', pending_assets_raw: '0', pending_shares_raw: '0',
  claimable_assets_raw: '0', claimable_shares_raw: '0', claimed_assets_raw: '0', claimed_shares_raw: '0',
  requested_at: null, claimable_at: null, claimed_at: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  display: {
    offer: { name: 'Offer' },
    asset: { address: '0xasset', symbol: 'USDC', decimals: 0 },
    share: null,
  },
  request_operation: null, fulfillment_operation: null, claim_operation: null,
  ...overrides,
});

describe('redemption lifecycle client', () => {
  it('preserves zero decimals and nullable display metadata', () => {
    const parsed = validateRedemptionLifecycleResponse({ profile_id: 9, items: [item()] });
    expect(parsed.items[0].display.asset?.decimals).toBe(0);
    expect(parsed.items[0].display.share).toBeNull();
  });

  it('passes profile, abort signal, and offline fallback to the EVM client', async () => {
    const get = vi.fn(async (_path: string, config: Record<string, unknown>) => ({
      data: { profile_id: 9, items: [item()] },
      headers: new Headers({ 'x-invest-offline-source': 'offline-cache', 'x-invest-offline-last-synced-at': '2026-01-01T00:00:00Z' }),
      ...config,
    }));
    const signal = new AbortController().signal;
    const result = await createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9, { signal, allowOfflineFallback: true });
    expect(get).toHaveBeenCalledWith('/auth/redemptions', expect.objectContaining({
      params: { profile_id: 9 }, signal, offlineFallback: true,
    }));
    expect(result.source).toBe('offline-cache');
  });

  it('rejects an unknown source header', async () => {
    const get = vi.fn(async () => ({ data: { profile_id: 9, items: [item()] }, headers: new Headers({ 'x-invest-offline-source': 'mystery' }) }));
    await expect(createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9)).rejects.toThrow('source is invalid');
  });

  it.each([true, false])('rejects a response with no source header when offline fallback is %s', async (allowOfflineFallback) => {
    const get = vi.fn(async () => ({ data: { profile_id: 9, items: [item()] }, headers: new Headers() }));
    await expect(createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9, { allowOfflineFallback })).rejects.toThrow('source is invalid');
  });

  it('uses the real ApiClient persistence metadata for network reads and cache fallback', async () => {
    const networkFetch = vi.fn(async () => new Response(JSON.stringify({ profile_id: 9, items: [item()] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const persistOfflineResponse = vi.fn(async () => undefined);
    const networkClient = new ApiClient('https://evm.example.test', {
      fetch: networkFetch,
      hooks: createApiClientHooks({
        isOnline: () => true,
        matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
        persistOfflineResponse,
      }),
    });
    const networkResult = await createRedemptionLifecycleClient(networkClient).listRedemptionLifecycles(9);
    expect(networkResult.source).toBe('network');
    expect(networkResult.lastSyncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(persistOfflineResponse).toHaveBeenCalledOnce();

    const cachedClient = new ApiClient('https://evm.example.test', {
      fetch: vi.fn(async () => { throw new TypeError('offline'); }),
      hooks: createApiClientHooks({
        isOnline: () => false,
        matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
        readOfflineResponse: async <T>() => ({
          data: { profile_id: 9, items: [item()] } as T,
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
            'x-invest-offline-source': 'offline-cache',
            'x-invest-offline-last-synced-at': '2026-01-01T00:00:00Z',
          }),
        }),
      }),
    });
    const cachedResult = await createRedemptionLifecycleClient(cachedClient).listRedemptionLifecycles(9);
    expect(cachedResult).toMatchObject({ source: 'offline-cache', lastSyncedAt: '2026-01-01T00:00:00Z' });
  });

  it('accepts network cache metadata added by the ApiClient persistence hook', async () => {
    const get = vi.fn(async () => ({
      data: { profile_id: 9, items: [item()] },
      headers: new Headers({ 'x-invest-offline-source': 'network', 'x-invest-offline-last-synced-at': '2026-01-01T00:00:00Z' }),
    }));
    await expect(createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9)).resolves.toMatchObject({
      source: 'network',
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('rejects an offline response without a nonblank cache timestamp', async () => {
    const get = vi.fn(async () => ({
      data: { profile_id: 9, items: [item()] },
      headers: new Headers({ 'x-invest-offline-source': 'offline-cache', 'x-invest-offline-last-synced-at': ' ' }),
    }));
    await expect(createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9)).rejects.toThrow('missing cache metadata');
  });

  it('rejects an offline response without a cache timestamp header', async () => {
    const get = vi.fn(async () => ({
      data: { profile_id: 9, items: [item()] },
      headers: new Headers({ 'x-invest-offline-source': 'offline-cache' }),
    }));
    await expect(createRedemptionLifecycleClient({ get } as never).listRedemptionLifecycles(9)).rejects.toThrow('missing cache metadata');
  });

  it('rejects an unknown transport reason while allowing known reasons in unexpected tuples', () => {
    expect(() => validateRedemptionLifecycleResponse({
      profile_id: 9,
      items: [item({ vault_status: 'request_available', vault_status_reason: 'request_submitted' })],
    })).not.toThrow();
    expect(() => validateRedemptionLifecycleResponse({
      profile_id: 9,
      items: [item({ vault_status_reason: 'unknown_reason' })],
    })).toThrow('vault_status_reason has an invalid value');
  });
});
