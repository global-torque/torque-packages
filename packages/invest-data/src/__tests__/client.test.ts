import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInvestDataClient,
  createInvestDataClientFromAppConfig,
  InvestDataHttpError,
} from '../client.ts';
import { createEvmWalletRepository } from '../evm.ts';
import type { InvestAppConfig } from '@webdevelop-pro/invest-core/app/config';

const createResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    ...init,
  });

describe('invest-data client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds requests from injected base URL, fetch, auth headers, and query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ ok: true }));
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test/v1/',
      fetch: fetchMock,
      hooks: {
        getAuthHeaders: () => ({
          authorization: 'Bearer token',
        }),
      },
    });

    await expect(
      client.get('/auth/wallet/7', {
        query: {
          chain: 'ethereum-sepolia',
          empty: undefined,
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/auth/wallet/7?chain=ethereum-sepolia',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer token');
  });

  it('maps non-ok responses to InvestDataHttpError with parsed response data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createResponse({ message: 'Nope' }, { status: 422 }));
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test',
      fetch: fetchMock,
    });

    await expect(
      client.post('/auth/wallet/register/7', { address: '0xabc' }),
    ).rejects.toMatchObject({
      name: 'InvestDataHttpError',
      status: 422,
      statusCode: 422,
      data: { message: 'Nope' },
      httpRequest: expect.objectContaining({
        method: 'POST',
        url: 'https://api.example.test/auth/wallet/register/7',
        path: '/auth/wallet/register/7',
      }),
      body: { redacted: true },
    } satisfies Partial<InvestDataHttpError>);
  });

  it('wraps fetch failures with request context before calling onError hooks', async () => {
    const onError = vi.fn();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test',
      fetch: fetchMock,
      hooks: { onError },
    });

    await expect(
      client.get('/auth/wallet/7', {
        query: { chain: 'ethereum-sepolia' },
      }),
    ).rejects.toMatchObject({
      name: 'NetworkRequestError',
      data: {
        statusCode: 0,
        causeMessage: 'Network transport failed',
        httpRequest: expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.test/auth/wallet/7',
          path: '/auth/wallet/7',
        }),
      },
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          name: 'NetworkRequestError',
        }),
      }),
    );
  });

  it('calls onResponse once and preserves legacy network projection when that hook fails', async () => {
    const hookFailure = new Error('response observer failed');
    const onResponse = vi.fn().mockRejectedValue(hookFailure);
    const onError = vi.fn();
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test',
      fetch: vi.fn().mockResolvedValue(createResponse({ ok: true })),
      hooks: { onResponse, onError },
    });

    await expect(client.get('/health')).rejects.toMatchObject({
      name: 'NetworkRequestError',
      data: expect.objectContaining({
        causeMessage: 'Network transport failed',
      }),
    });
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('preserves HTTP protocol data while keeping it out of serialized diagnostics', async () => {
    vi.stubGlobal('document', {
      referrer: 'https://app.example.test/from?token=REFERER_SECRET#private',
    });
    const onResponse = vi.fn();
    const onError = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Invalid wallet request',
          field: 'Wrong value',
          password: 'PASSWORD_SECRET',
          token: 'TOKEN_SECRET',
          ui: {
            nodes: [
              {
                attributes: { name: 'totp_code', value: 'TOTP_SECRET' },
                messages: [{ type: 'error', text: 'Invalid code' }],
              },
            ],
          },
        }),
        {
          status: 422,
          headers: {
            'content-type': 'application/json',
            'x-debug-token': 'HEADER_SECRET',
          },
        },
      ),
    );
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test',
      fetch: fetchMock,
      hooks: { onResponse, onError },
    });

    let caught: unknown;
    try {
      await client.get('/auth/token/PATH_SECRET', {
        query: { token: 'QUERY_SECRET' },
        headers: { authorization: 'Bearer AUTH_SECRET' },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvestDataHttpError);
    const httpError = caught as InvestDataHttpError;
    expect(httpError.data).toEqual({
      message: 'Invalid wallet request',
      field: 'Wrong value',
      password: 'PASSWORD_SECRET',
      token: 'TOKEN_SECRET',
      ui: {
        nodes: [
          {
            attributes: { name: 'totp_code', value: 'TOTP_SECRET' },
            messages: [{ type: 'error', text: 'Invalid code' }],
          },
        ],
      },
    });
    expect(httpError.httpRequest).toMatchObject({
      url: 'https://api.example.test/auth/token/[redacted]',
      path: '/auth/token/[redacted]',
      referer: 'https://app.example.test/from',
    });
    expect(httpError.response.headers.get('x-debug-token')).toBe('HEADER_SECRET');
    await expect(httpError.response.clone().json()).resolves.toEqual(httpError.data);
    const responseHook = onResponse.mock.calls[0]?.[0] as {
      url: string;
      headers: Headers;
      response: Response;
    };
    expect(responseHook.url).toBe('https://api.example.test/auth/token/[redacted]');
    expect(responseHook.headers.get('authorization')).toBeNull();
    expect(responseHook.response.headers.get('x-debug-token')).toBeNull();
    await expect(responseHook.response.text()).resolves.toBe('');
    expect(JSON.stringify({ httpError, onError: onError.mock.calls[0]?.[0] })).not.toMatch(
      /(?:PASSWORD|TOKEN|TOTP|HEADER|QUERY|AUTH|REFERER|PATH)_SECRET/u,
    );
  });

  it('does not serialize secret-bearing fetch failures, queries, referrers, or stacks', async () => {
    vi.stubGlobal('document', {
      referrer: 'https://app.example.test/from?token=REFERER_SECRET#private',
    });
    const client = createInvestDataClient({
      baseUrl: 'https://api.example.test',
      fetch: vi
        .fn()
        .mockRejectedValue(new TypeError('Bearer FETCH_SECRET token=FETCH_TOKEN_SECRET')),
    });

    let caught: unknown;
    try {
      await client.get('/auth/wallet/7', { query: { token: 'QUERY_SECRET' } });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toMatchObject({
      name: 'NetworkRequestError',
      data: {
        causeMessage: 'Network transport failed',
        stack: '',
        httpRequest: {
          url: 'https://api.example.test/auth/wallet/7',
          referer: 'https://app.example.test/from',
        },
      },
    });
    expect(JSON.stringify(caught)).not.toMatch(/(?:FETCH|QUERY|REFERER)_SECRET/u);
  });

  it('creates EVM repository methods from injected app config', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ session_id: 'session-1' }));
    const appConfig = {
      urls: {
        api: {
          evm: 'https://evm.example.test',
        },
      },
      brand: {
        title: 'Global Torque',
        description: 'Invest',
      },
      thirdParty: {},
    } as InvestAppConfig;
    const client = createInvestDataClientFromAppConfig(appConfig, 'evm', {
      fetch: fetchMock,
    });
    const repository = createEvmWalletRepository(client);

    await repository.authorizeWithdrawStart(7, {
      authorization_option_id: 'exchange_transfer',
      operation_type: 'exchange',
      chain: 'ethereum-sepolia',
      asset_address: '0xusdc',
      to_asset_address: '0xbtrp',
      max_amount: '10',
      quote_price_usd: '7.1615',
      minimum_payout_amount: '71.615',
      nonce: 'exc_test_0001',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://evm.example.test/auth/wallet/authorize/start/7',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          authorization_option_id: 'exchange_transfer',
          operation_type: 'exchange',
          chain: 'ethereum-sepolia',
          asset_address: '0xusdc',
          to_asset_address: '0xbtrp',
          max_amount: '10',
          quote_price_usd: '7.1615',
          minimum_payout_amount: '71.615',
          nonce: 'exc_test_0001',
        }),
      }),
    );
  });
});
