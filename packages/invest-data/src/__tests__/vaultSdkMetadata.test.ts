import { describe, expect, it, vi } from 'vitest';
import type { SdkServiceClient } from '@global-torque/sdk';
import { ApiClient } from '../service/apiClient.ts';
import { createApiClientHooks } from '../service/apiClientHooks.ts';
import { createVaultClient } from '../vault.ts';

const captured = vi.hoisted(() => ({
  client: undefined as SdkServiceClient | undefined,
}));

vi.mock('@global-torque/sdk/resources/vault', () => ({
  createVaultResource: (client: SdkServiceClient) => {
    captured.client = client;
    return {};
  },
}));

describe('Vault SDK compatibility metadata', () => {
  it('forwards measured retries and unique client correlation without inventing provenance', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 1 }), {
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 2 }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    let requestNumber = 0;
    const hooks = createApiClientHooks({
      createRequestId: () => `vault-client-request-${++requestNumber}`,
      isOnline: () => true,
    });
    const apiClient = new ApiClient('https://investment.example.test', {
      fetch: fetchMock,
      hooks,
    });

    createVaultClient({ investment: apiClient, evm: apiClient });
    const bridge = captured.client;
    expect(bridge).toBeDefined();

    const retried = await bridge!.get('/first', {
      retry: { maxRetries: 1, delayMs: 0 },
    });
    const next = await bridge!.get('/second');

    expect(retried.metadata).toEqual({
      requestId: 'vault-client-request-1',
      attempts: 2,
      source: 'unknown',
    });
    expect(Object.isFrozen(retried.metadata)).toBe(true);
    expect(next.metadata).toEqual({
      requestId: 'vault-client-request-2',
      attempts: 1,
      source: 'unknown',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
