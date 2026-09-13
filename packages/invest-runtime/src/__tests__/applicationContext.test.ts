import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { createApiClientHooks } from '@global-torque/invest-data/service/apiClientHooks';
import type { InvestAppConfig } from '@global-torque/invest-core/app/config';
import {
  cookieAuth,
  SdkResponseValidationError,
} from '@global-torque/sdk';
import {
  createInvestApplicationContext,
  getInvestApplicationContextFallbackSnapshot,
  installInvestApplicationContext,
  InvestApplicationContextDisposedError,
  InvestApplicationContextError,
  resetInvestApplicationContextForTests,
  resolveInvestApplicationContextForCompatibility,
  useInvestApplicationContext,
} from '../applicationContext.ts';
import { installInvestRuntime } from '../install.ts';

const createConfig = (origin: string): InvestAppConfig => ({
  env: 'test',
  isDev: true,
  isStaticSite: false,
  enableAnalytics: false,
  cookieDomain: '.example.test',
  urls: {
    frontend: origin,
    dashboard: `${origin}/dashboard`,
    static: `${origin}/static`,
    cryptoWalletScan: `${origin}/scan`,
    api: {
      user: `${origin}/user`,
      offer: `${origin}/offer`,
      evm: `${origin}/evm`,
      esign: `${origin}/esign`,
      investment: `${origin}/investment`,
      fundManager: `${origin}/fund-manager`,
    },
  },
  brand: {
    title: 'Test',
    description: 'Test application',
  },
  thirdParty: {},
});

const createHooks = (requestId: string) =>
  createApiClientHooks({
    createRequestId: () => requestId,
  });

describe('InvestApplicationContext', () => {
  afterEach(() => {
    resetInvestApplicationContextForTests();
    vi.unstubAllGlobals();
  });

  it('owns an immutable copy of application and data configuration', () => {
    const input = createConfig('https://one.example.test');
    const context = createInvestApplicationContext({ appConfig: input });

    input.urls.api.user = 'https://mutated.example.test';

    expect(context.appConfig.urls.api.user).toBe(
      'https://one.example.test/user',
    );
    expect(context.dataClientConfig.apiUrls?.user).toBe(
      'https://one.example.test/user',
    );
    expect(Object.isFrozen(context.appConfig.urls.api)).toBe(true);
    expect(() => {
      (context.appConfig.urls.api as { user?: string }).user =
        'https://blocked.example.test';
    }).toThrow();
  });

  it('rejects split runtime configuration when a supplied context does not match appConfig', () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });

    expect(() =>
      installInvestRuntime({
        appConfig: createConfig('https://two.example.test'),
        applicationContext: context,
        installApiClientHooks: false,
        installErrorHandling: false,
      }),
    ).toThrow('does not match the supplied application context');
  });

  it('isolates origins, request hooks, and adapters between concurrent contexts', async () => {
    const fetchOne = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ context: 'one' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const fetchTwo = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ context: 'two' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const contextOne = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createHooks('request-one'),
      adapters: { auth: { getSession: async () => ({ id: 'one' }) } },
      fetch: fetchOne,
    });
    const contextTwo = createInvestApplicationContext({
      appConfig: createConfig('https://two.example.test'),
      apiClientHooks: createHooks('request-two'),
      adapters: { auth: { getSession: async () => ({ id: 'two' }) } },
      fetch: fetchTwo,
    });

    const [one, two] = await Promise.all([
      contextOne.createApiClient('user').get<{ context: string }>('/session'),
      contextTwo.createApiClient('user').get<{ context: string }>('/session'),
    ]);

    expect(one.data).toEqual({ context: 'one' });
    expect(two.data).toEqual({ context: 'two' });
    expect(fetchOne).toHaveBeenCalledWith(
      'https://one.example.test/user/session',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Request-ID': 'request-one' }),
      }),
    );
    expect(fetchTwo).toHaveBeenCalledWith(
      'https://two.example.test/user/session',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Request-ID': 'request-two' }),
      }),
    );
    await expect(contextOne.getAdapters().auth?.getSession()).resolves.toEqual({
      id: 'one',
    });
    await expect(contextTwo.getAdapters().auth?.getSession()).resolves.toEqual({
      id: 'two',
    });
  });

  it('keeps application credentials context-owned and keyed-client-only', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      applicationKey: 'tahoe_sandbox_public_key',
      apiClientHooks: createHooks('request-one'),
      fetch: fetchImpl,
    });

    await context.createKeyedApiClient('fundManager').get('/auth/investors');
    await context.createApiClient('user').get('/session');

    const keyedHeaders = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    const keylessHeaders = new Headers(fetchImpl.mock.calls[1]?.[1]?.headers);
    expect(keyedHeaders.get('X-API-Key')).toBe('tahoe_sandbox_public_key');
    expect(keylessHeaders.has('X-API-Key')).toBe(false);
  });

  it('creates direct typed SDK clients with explicit auth and response validation', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'profile-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createHooks('request-one'),
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
    });
    const reusedClient = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
    });

    expect(reusedClient).toBe(client);
    const result = await client.get<{ data: readonly { id: string }[] }>(
      '/auth/investors',
      {
        operationId: 'TahoeFundManagerProfileList',
        responseMode: 'json',
        responseValidator: (value) => {
          if (
            !value ||
            typeof value !== 'object' ||
            !Array.isArray((value as { data?: unknown }).data)
          ) {
            throw new TypeError('Invalid profile list response.');
          }
          return value as { data: readonly { id: string }[] };
        },
      },
    );

    expect(result.data.data).toEqual([{ id: 'profile-1' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://one.example.test/fund-manager/auth/investors',
    );
    expect(init?.credentials).toBe('include');
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Request-ID')).toBe('request-one');
    expect(headers.has('X-API-Key')).toBe(false);
  });

  it('creates a user-service Invitations resource with cookie auth and per-operation policy', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          email: 'invitee@example.test',
          expiresAt: '2030-01-01T00:00:00Z',
          firstName: 'Invite',
          kind: 'investor',
          lastName: 'Recipient',
          profileType: 'entity',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockRejectedValueOnce(new TypeError('ambiguous mutation failure'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ unreachable: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createHooks('invitation-request'),
      fetch: fetchImpl,
    });
    const signal = new AbortController().signal;
    const invitations = context.createInvitationsSdkResource();

    await invitations.preview({
      body: { code: 'preview-code' },
      request: { cache: 'no-store', retry: { maxRetries: 0 }, signal },
    });
    await expect(
      invitations.accept({
        body: { code: 'accept-code', selectedProfileType: 'entity' },
        request: { cache: 'no-store', retry: { maxRetries: 0 } },
      }),
    ).rejects.toMatchObject({ code: 'SDK_NETWORK_FAILED' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [previewUrl, previewInit] = fetchImpl.mock.calls[0] ?? [];
    expect(String(previewUrl)).toBe(
      'https://one.example.test/user/public/invitations/preview',
    );
    expect(previewInit).toMatchObject({
      cache: 'no-store',
      credentials: 'include',
      method: 'POST',
      redirect: 'follow',
      signal,
    });
    const previewHeaders = new Headers(previewInit?.headers);
    expect(previewHeaders.get('X-Request-ID')).toBe('invitation-request');
    expect(previewHeaders.has('Authorization')).toBe(false);
    expect(previewHeaders.has('X-API-Key')).toBe(false);
    context.dispose();
  });

  it('preserves HEAD on the runtime offline-persistence wrapper', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200, headers: { 'x-resource-version': '7' } }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
      offlinePolicy: 'runtime',
    });

    const result = await client.head('/auth/investors');

    expect(result.status).toBe(200);
    expect(result.headers.get('x-resource-version')).toBe('7');
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('HEAD');
  });

  it('keeps direct SDK application-key use explicit and exact-origin scoped', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      applicationKey: 'tahoe_sandbox_public_key',
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'api-key',
      auth: cookieAuth({ credentials: 'include' }),
    });

    await client.get('/auth/investors', {
      operationId: 'TahoeFundManagerProfileList',
      responseMode: 'json',
    });

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get('X-API-Key')).toBe('tahoe_sandbox_public_key');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('creates contract-backed EVM, Investments, Offers, and Vault resources with reviewed auth defaults', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile_id: 7,
            wallet_status: 'created',
            wallet_address: '0x1111111111111111111111111111111111111111',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 0, data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          position: {
            offer_id: 77,
            profile_id: 42,
            vault: {
              deployment: {
                contract_id: 754,
                status: 'confirmed',
                chain: 'ethereum-sepolia',
                address: '0x1111111111111111111111111111111111111111',
                asset: {
                  symbol: 'USDC',
                  address: '0x2222222222222222222222222222222222222222',
                  decimals: 6,
                },
                share: {
                  symbol: 'RWA',
                  address: '0x1111111111111111111111111111111111111111',
                  decimals: 18,
                },
              },
              deposit: null,
              position: {
                share_balance_raw: '0',
                historical_claimed_shares_raw: '0',
                available_to_redeem_shares_raw: '0',
              },
              redemptions: [],
            },
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 0, data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });

    await context.createEvmSdkResource().getWalletInfo({
      profileId: 7,
      chain: 'ethereum',
    });
    await context.createOffersSdkResource().listOffers();
    await context.createVaultSdkResource().getPosition({ offerId: 77 });
    await context
      .createInvestmentsSdkResource()
      .listConfirmedByProfile({ profileId: 42 });

    const [evmUrl, evmInit] = fetchImpl.mock.calls[0] ?? [];
    expect(String(evmUrl)).toBe(
      'https://one.example.test/evm/auth/wallet/7?chain=ethereum',
    );
    expect(evmInit?.credentials).toBe('include');
    expect(new Headers(evmInit?.headers).get('accept')).toBe(
      'application/json',
    );

    const [offersUrl, offersInit] = fetchImpl.mock.calls[1] ?? [];
    expect(String(offersUrl)).toBe(
      'https://one.example.test/offer/public/offer',
    );
    expect(offersInit?.credentials).toBe('include');
    expect(new Headers(offersInit?.headers).get('accept')).toBe(
      'application/json',
    );

    const [vaultUrl, vaultInit] = fetchImpl.mock.calls[2] ?? [];
    expect(String(vaultUrl)).toBe(
      'https://one.example.test/investment/auth/positions?offer_id=77',
    );
    expect(vaultInit?.credentials).toBe('include');
    expect(new Headers(vaultInit?.headers).get('accept')).toBe(
      'application/json',
    );

    const [investmentsUrl, investmentsInit] = fetchImpl.mock.calls[3] ?? [];
    expect(String(investmentsUrl)).toBe(
      'https://one.example.test/investment/auth/investment/42/confirmed',
    );
    expect(investmentsInit?.credentials).toBe('include');
  });

  it('uses the authoritative keyless cookie policy for the e-sign resource', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        created_at: '2026-08-09T12:00:00Z',
        entity_id: 'submission-1',
        id: '31',
        token: 'opaque-server-token',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
      }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });

    await context.createEsignSdkResource().createDocument({
      body: { investment_id: 45921 },
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://one.example.test/esign/auth/document');
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('x-api-key')).toBeNull();
  });

  it('preserves the compatibility safe-read network retry for SDK resources', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('temporary network failure'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 0, data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });

    await context.createOffersSdkResource().listOffers();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('persists SDK resource reads and returns offline metadata headers', async () => {
    const persistOfflineResponse = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ count: 0, data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createApiClientHooks({
        isOnline: () => true,
        matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
        persistOfflineResponse,
      }),
      fetch: fetchImpl,
    });

    const result = await context.createOffersSdkResource().listOffers();

    expect(result.metadata.source).toBe('network');
    expect(Object.isFrozen(result.metadata)).toBe(true);
    expect(result.headers.get('x-invest-offline-source')).toBe('network');
    expect(result.headers.get('x-invest-offline-last-synced-at')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/u,
    );
    expect(persistOfflineResponse).toHaveBeenCalledWith(
      { persistToIndexedDb: true },
      'https://one.example.test/offer/public/offer',
      expect.objectContaining({
        data: { count: 0, data: [] },
        payloadType: 'json',
        status: 200,
      }),
    );
  });

  it('never replaces offline data with a response rejected by the SDK validator', async () => {
    const persistOfflineResponse = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ count: 'invalid', data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createApiClientHooks({
        isOnline: () => true,
        matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
        persistOfflineResponse,
      }),
      fetch: fetchImpl,
    });

    await expect(
      context.createOffersSdkResource().listOffers(),
    ).rejects.toBeInstanceOf(SdkResponseValidationError);

    expect(persistOfflineResponse).not.toHaveBeenCalled();
  });

  it('keeps migrated EVM and Offers safe reads on the legacy no-timeout policy', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile_id: 7,
            wallet_status: 'created',
            wallet_address: '0x1111111111111111111111111111111111111111',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 0, data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });

    await context
      .createEvmSdkResource()
      .getWalletInfo({ profileId: 7, chain: 'ethereum' });
    await context.createOffersSdkResource().listOffers();

    expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 30_000);
  });

  it('validates and returns an IndexedDB fallback after an SDK network failure', async () => {
    const readOfflineResponse = vi.fn().mockResolvedValue({
      data: { count: 1, data: [{ id: 7, slug: 'cached' }] },
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      lastSyncedAt: '2026-07-28T12:00:00.000Z',
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('network unavailable'));
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createApiClientHooks({
        isOnline: () => false,
        matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
        readOfflineResponse,
      }),
      fetch: fetchImpl,
    });

    const result = await context.createOffersSdkResource().listOffers();

    expect(result.data.data?.[0]?.slug).toBe('cached');
    expect(result.metadata.source).toBe('offline-cache');
    expect(result.headers.get('x-invest-offline-source')).toBe('offline-cache');
    expect(result.headers.get('x-invest-offline-last-synced-at')).toBe(
      '2026-07-28T12:00:00.000Z',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects insecure SDK service origins unless the context explicitly allows them', () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('http://api.example.test'),
    });

    expect(() =>
      context.createSdkServiceClient('fundManager', {
        applicationAuth: 'none',
        auth: cookieAuth({ credentials: 'include' }),
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'SdkConfigurationError',
        code: 'SDK_SERVICE_PROTOCOL_UNSUPPORTED',
      }),
    );
  });

  it('allows only an explicitly listed insecure local-development SDK origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('http://localhost:4010'),
      allowInsecureSdkOrigins: ['http://localhost:4010'],
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
    });

    await client.get('/auth/investors', { responseMode: 'json' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'http://localhost:4010/fund-manager/auth/investors',
    );
  });

  it('forwards the explicit insecure-origin allowlist to legacy and raw clients', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('http://localhost:4010'),
      allowInsecureSdkOrigins: ['http://localhost:4010'],
      fetch: fetchImpl,
    });

    await context.createApiClient('user').get('/session');
    await context.createRawClient('user').get('/session');

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:4010/user/session',
      'http://localhost:4010/user/session',
    ]);
  });

  it('sanitizes direct SDK validator failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: 'not-an-array' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
    });

    const error = await client
      .get('/auth/investors', {
        operationId: 'TahoeFundManagerProfileList',
        responseMode: 'json',
        responseValidator: () => {
          throw new Error('raw backend validation details');
        },
      })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SdkResponseValidationError);
    expect(error).toMatchObject({
      name: 'SdkResponseValidationError',
      code: 'SDK_RESPONSE_VALIDATION_FAILED',
    });
    expect((error as Error).message).not.toContain(
      'raw backend validation details',
    );
  });

  it('aborts outstanding direct SDK requests when the application context is disposed', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(init.signal?.reason);
            },
            { once: true },
          );
        }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      fetch: fetchImpl,
    });
    const client = context.createSdkServiceClient('fundManager', {
      applicationAuth: 'none',
      auth: cookieAuth({ credentials: 'include' }),
    });
    const request = client.get('/auth/investors', {
      operationId: 'TahoeFundManagerProfileList',
      responseMode: 'json',
      timeoutMs: null,
    });

    context.dispose();

    await expect(request).rejects.toMatchObject({
      name: 'SdkAbortError',
      code: 'SDK_ABORTED',
      route: 'TahoeFundManagerProfileList',
    });
  });

  it('fails closed when a keyed client is requested without an application credential', () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });

    expect(() => context.createKeyedApiClient('fundManager')).toThrow(
      'No application key is configured',
    );
  });

  it('provides a typed Vue context and fails when it is missing', () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });
    const Consumer = defineComponent({
      setup: () => ({ context: useInvestApplicationContext() }),
      template: '<div>{{ context.appConfig.brand.title }}</div>',
    });
    const app = createApp(Consumer);
    installInvestApplicationContext(app, context);
    const element = document.createElement('div');
    document.body.append(element);
    app.mount(element);

    expect(element.textContent).toBe('Test');
    app.unmount();
    expect(context.isDisposed).toBe(true);

    expect(() => mount(Consumer)).toThrow(InvestApplicationContextError);
  });

  it('installs idempotently in one Vue app and accepts adapter wiring after SSR creation', async () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });
    const app = createApp({ template: '<div />' });

    expect(installInvestApplicationContext(app, context)).toBe(context);
    expect(installInvestApplicationContext(app, context)).toBe(context);
    context.configureAdapters({
      auth: { getSession: async () => ({ id: 'hydrated' }) },
    });

    await expect(context.getAdapters().auth?.getSession()).resolves.toEqual({
      id: 'hydrated',
    });
    expect(
      getInvestApplicationContextFallbackSnapshot().activeContextCount,
    ).toBe(1);

    const differentContext = createInvestApplicationContext({
      appConfig: createConfig('https://two.example.test'),
    });
    expect(() =>
      installInvestApplicationContext(app, differentContext),
    ).toThrow('A different invest application context is already installed');
  });

  it('measures a single browser fallback and rejects ambiguous fallback', () => {
    const first = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });
    const second = createInvestApplicationContext({
      appConfig: createConfig('https://two.example.test'),
    });
    const firstApp = createApp({ template: '<div />' });
    const secondApp = createApp({ template: '<div />' });
    installInvestApplicationContext(firstApp, first);

    expect(
      resolveInvestApplicationContextForCompatibility('legacy-user-repository'),
    ).toBe(first);
    expect(getInvestApplicationContextFallbackSnapshot()).toEqual({
      activeContextCount: 1,
      totalFallbackResolutions: 1,
      consumers: { 'legacy-user-repository': 1 },
    });

    installInvestApplicationContext(secondApp, second);
    expect(() =>
      resolveInvestApplicationContextForCompatibility(
        'legacy-offer-repository',
      ),
    ).toThrow('cannot choose between 2 active application contexts');
  });

  it('disables compatibility fallback during SSR even when contexts exist', () => {
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
    });
    const app = createApp({ template: '<div />' });
    installInvestApplicationContext(app, context);
    vi.stubGlobal('window', undefined);

    expect(() =>
      resolveInvestApplicationContextForCompatibility('ssr-consumer'),
    ).toThrow('Compatibility context fallback is disabled during SSR');
  });

  it('invalidates existing and future clients after disposal', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createHooks('request-one'),
      fetch: fetchImpl,
    });
    const client = context.createApiClient('user');

    context.dispose();

    expect(() => context.createApiClient('user')).toThrow(
      InvestApplicationContextDisposedError,
    );
    await expect(client.get('/session')).rejects.toBeInstanceOf(
      InvestApplicationContextDisposedError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aborts context-owned in-flight requests during disposal', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    const context = createInvestApplicationContext({
      appConfig: createConfig('https://one.example.test'),
      apiClientHooks: createHooks('request-one'),
      fetch: fetchImpl,
    });
    const request = context.createApiClient('user').get('/session');

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    context.dispose();

    await expect(request).rejects.toBeInstanceOf(
      InvestApplicationContextDisposedError,
    );
  });
});
