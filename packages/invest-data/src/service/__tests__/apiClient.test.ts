import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ApiClient } from '../apiClient.ts';
import {
  configureApiClientHooks,
  resetApiClientHooks,
} from '../apiClientHooks.ts';
import { OfflineRequestError } from '../handlers/offlineRequestError.ts';
import { NetworkRequestError } from '../handlers/networkRequestError.ts';

describe('legacy ApiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetApiClientHooks();
    configureApiClientHooks({
      createRequestId: () => 'request-1',
      isOnline: () => true,
      normalizeAnalyticsBodyForMethod: (_method, body) => (
        body ? { body: String(body) } : {}
      ),
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
    resetApiClientHooks();
  });

  it('builds a full request with default headers and query params', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const client = new ApiClient('https://api.example.test');
    const response = await client.get('/items', {
      params: {
        page: 2,
        skip: undefined,
      },
    });

    expect(response.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/items?page=2',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        headers: expect.objectContaining({
          accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Request-ID': 'request-1',
        }),
      }),
    );
  });

  it('injects a context-owned application key only for the configured origin', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient('https://fund-manager.example.test/v1', {
      applicationKey: 'tahoe_sandbox_public_key',
    });

    await client.get('/auth/investors');

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('X-API-Key')).toBe('tahoe_sandbox_public_key');
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('error');
    await expect(client.get('https://untrusted.example.test/collect')).rejects.toMatchObject({
      name: 'SdkConfigurationError',
      code: 'SDK_APPLICATION_KEY_ORIGIN_MISMATCH',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves followed redirects for the keyless compatibility transport', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient('https://api.example.test');

    await client.get('/redirected-read');

    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('follow');
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('X-API-Key')).toBe(false);
  });

  it('rejects caller overrides of a context-owned application key', async () => {
    const client = new ApiClient('https://fund-manager.example.test/v1', {
      applicationKey: 'tahoe_sandbox_public_key',
    });

    await expect(client.get('/auth/investors', {
      headers: { 'X-API-Key': 'replacement-key' },
    })).rejects.toMatchObject({
      name: 'SdkConfigurationError',
      code: 'SDK_APPLICATION_KEY_HEADER_OVERRIDE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws APIError with parsed response JSON for non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ __error__: 'No access' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }));

    const client = new ApiClient('https://api.example.test');

    await expect(client.post('/items', { name: 'Test' }))
      .rejects
      .toMatchObject({
        name: 'APIError',
        message: 'No access',
        data: {
          statusCode: 403,
            responseJson: { __error__: 'No access' },
        },
      });
  });

  it('wraps fetch failures in NetworkRequestError with request metadata', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const client = new ApiClient('https://api.example.test');
    const promise = client.get('/items', {
      params: { page: 1 },
      retry: 0,
    });

    await expect(promise).rejects.toBeInstanceOf(NetworkRequestError);
    await expect(promise).rejects.toMatchObject({
      name: 'NetworkRequestError',
      message: 'Network request failed',
      data: {
        statusCode: 0,
        body: {},
        causeMessage: 'Network transport failed',
        retryable: true,
        attempts: 1,
        httpRequest: expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.test/items?page=1',
          path: '/items',
        }),
      },
    });
  });

  it('default hooks project diagnostics selectively while preserving legacy request body and auth', async () => {
    resetApiClientHooks();
    configureApiClientHooks({
      createRequestId: () => 'request-default-policy',
      isOnline: () => true,
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const body = {
      email: 'user@example.com',
      offer_id: 42,
      password: 'PASSWORD_SECRET',
    };
    const client = new ApiClient('https://api.example.test');

    let caught: NetworkRequestError | undefined;
    try {
      await client.post('/offers', body, {
        retry: 0,
        headers: { authorization: 'Bearer AUTH_SECRET' },
      });
    } catch (error) {
      caught = error as NetworkRequestError;
    }

    expect(caught?.data.body).toEqual({
      email: 'user@example.com',
      offer_id: 42,
      password: '[redacted]',
    });
    expect(body).toEqual({
      email: 'user@example.com',
      offer_id: 42,
      password: 'PASSWORD_SECRET',
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(body));
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer AUTH_SECRET');
  });

  it('retries idempotent network failures once by default', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network is down'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    const client = new ApiClient('https://api.example.test');
    const response = await client.get('/items', { retryDelayMs: 0 });

    expect(response.data).toEqual({ ok: true });
    expect(response.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry mutation network failures by default', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network is down'));

    const client = new ApiClient('https://api.example.test');
    const promise = client.post('/items', { name: 'Test' });

    await expect(promise).rejects.toMatchObject({
      name: 'NetworkRequestError',
      data: {
        retryable: false,
        attempts: 1,
        httpRequest: expect.objectContaining({
          method: 'POST',
        }),
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves aborted requests as native abort errors', async () => {
    const controller = new AbortController();
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    controller.abort(abortError);

    const client = new ApiClient('https://api.example.test');
    const promise = client.get('/items', {
      signal: controller.signal,
    });

    await expect(promise).rejects.toBe(abortError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks mutations while offline unless explicitly allowed', async () => {
    configureApiClientHooks({
      isOnline: () => false,
    });

    const client = new ApiClient('https://api.example.test');

    await expect(client.post('/items', { name: 'Test' }))
      .rejects
      .toBeInstanceOf(OfflineRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
