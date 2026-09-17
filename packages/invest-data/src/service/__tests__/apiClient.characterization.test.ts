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
  type ApiClientHooks,
} from '../apiClientHooks.ts';
import { APIError } from '../handlers/apiError.ts';
import { NetworkRequestError } from '../handlers/networkRequestError.ts';
import { OfflineRequestError } from '../handlers/offlineRequestError.ts';
import { createInvestDataClient } from '../../client.ts';
import { SdkTimeoutError } from '@global-torque/sdk';
import { executeCanonicalCompatibilityRequest } from '../../migration/canonicalCompatibilityTransport.ts';

describe('legacy ApiClient Phase 0 characterization', () => {
  const baseUrl = 'https://api.example.test';
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    resetApiClientHooks();
    configureApiClientHooks({
      createRequestId: () => 'generated-request-id',
      isOnline: () => true,
      matchOfflinePolicy: () => null,
      normalizeAnalyticsBodyForMethod: () => ({ redacted: true }),
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
    resetApiClientHooks();
    vi.useRealTimers();
  });

  it('transport:url preserves relative, absolute, override, and encoded query behavior', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient(baseUrl);

    await client.get('/relative', { params: { query: 'a b', zero: 0, no: false, nil: null } });
    await client.get('https://external.example.test/absolute');
    await client.get('/override', { baseURL: 'https://override.example.test' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${baseUrl}/relative?query=a+b&zero=0&no=false`,
      'https://external.example.test/absolute',
      'https://override.example.test/override',
    ]);
  });

  it('transport:fetch resolves the default global fetch at request time', async () => {
    const client = new ApiClient(baseUrl);
    const lateFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"late":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    globalThis.fetch = lateFetch;

    await expect(client.get('/late-fetch')).resolves.toMatchObject({
      data: { late: true },
      status: 200,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lateFetch).toHaveBeenCalledTimes(1);
  });

  it('transport:json preserves JSON success and APIError responseJson precedence', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('{"__error__":["first","second"]}', {
        status: 422,
        headers: { 'content-type': 'application/json' },
      }));
    const client = new ApiClient(baseUrl);

    await expect(client.get('/success')).resolves.toMatchObject({ data: { ok: true }, status: 200 });
    await expect(client.get('/failure')).rejects.toMatchObject({
      name: 'APIError',
      message: 'first; second',
      data: {
        statusCode: 422,
        responseJson: { __error__: ['first', 'second'] },
      },
    });
  });

  it('transport:api-error preserves the complete application-protocol body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      create_password: 'Password is too weak',
      repeat_password: 'Passwords do not match',
      password: 'actual-submitted-secret',
      email: 'Email is invalid',
    }), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    }));

    const projectedError = await new ApiClient(baseUrl).post('/settings', {
      password: 'actual-submitted-secret',
    }).catch(error => error);

    expect(projectedError).toMatchObject({
      name: 'APIError',
      data: {
        statusCode: 422,
        responseJson: {
          create_password: 'Password is too weak',
          repeat_password: 'Passwords do not match',
          password: 'actual-submitted-secret',
          email: 'Email is invalid',
        },
      },
    });
    expect(projectedError.data.responseJson).toEqual({
      create_password: 'Password is too weak',
      repeat_password: 'Passwords do not match',
      password: 'actual-submitted-secret',
      email: 'Email is invalid',
    });
  });

  it('preserves Ory redirect and unknown fields exactly while sanitizing request diagnostics', async () => {
    const responseBody = {
      error: { id: 'browser_location_change_required' },
      redirect_browser_to:
        'https://accounts.example.test/oauth?flow=flow-secret&provider=github&token=token-secret',
      unknown: { nested: ['kept'] },
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    }));

    const projectedError = await new ApiClient(baseUrl)
      .post('/self-service/login?flow=request-secret', { method: 'oidc' })
      .catch(error => error);

    expect(projectedError).toBeInstanceOf(APIError);
    expect(projectedError.data.responseJson).toEqual(responseBody);
    expect(projectedError.data.httpRequest.url).toBe(`${baseUrl}/self-service/login?flow=request-secret`);
    expect(projectedError.data.httpRequest.path).toBe('/self-service/login');
  });

  it.each([
    ['null', null],
    ['number', 42],
    ['string', 'protocol-message'],
    ['array', ['one', { two: true }]],
  ])('preserves a JSON %s body through APIError projection', async (_label, responseBody) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(responseBody), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));

    const projectedError = await new ApiClient(baseUrl)
      .get('/typed-error')
      .catch(error => error);

    expect(projectedError).toBeInstanceOf(APIError);
    expect(projectedError.data.responseJson).toEqual(responseBody);
  });

  it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])(
    'transport:http-error preserves structured HTTP %s status and response data',
    async (status) => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        message: `status-${status}`,
        field: ['Invalid value.'],
      }), {
        status,
        headers: { 'content-type': 'application/json' },
      }));
      const promise = new ApiClient(baseUrl).post('/validation', { value: 'invalid' });

      await expect(promise).rejects.toMatchObject({
        name: 'APIError',
        message: `status-${status}`,
        data: {
          statusCode: status,
          responseJson: {
            message: `status-${status}`,
            field: ['Invalid value.'],
          },
        },
      });
    },
  );

  it.each([
    ['text/html', '<html>Bad Request</html>'],
    ['text/plain', 'Bad Request'],
    [undefined, ''],
  ])('transport:http-error preserves HTTP 400 identity for an opaque %s body', async (contentType, body) => {
    fetchMock.mockResolvedValueOnce(new Response(body, {
      status: 400,
      headers: contentType ? { 'content-type': contentType } : undefined,
    }));
    const promise = new ApiClient(baseUrl).post('/validation', { value: 'invalid' });

    await expect(promise).rejects.toMatchObject({
      name: 'APIError',
      message: 'Failed to fetch data',
      data: { statusCode: 400, responseJson: null },
    });
  });

  it('transport:json characterizes malformed JSON without reclassifying it as a network failure', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{invalid', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('{invalid', {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }));
    const client = new ApiClient(baseUrl);

    await expect(client.get('/malformed-success')).rejects.toBeInstanceOf(SyntaxError);
    const errorPromise = client.get('/malformed-error');
    await expect(errorPromise).rejects.toBeInstanceOf(APIError);
    await expect(errorPromise).rejects.toMatchObject({
      data: { statusCode: 502, responseJson: null },
    });
  });

  it.each([
    ['transport:text', 'text', 'plain text'],
    ['transport:stream-is-text', 'stream', 'plain text'],
  ] as const)('%s parses the legacy mode as text', async (_testId, type, expected) => {
    fetchMock.mockResolvedValueOnce(new Response(expected, {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    }));
    const response = await new ApiClient(baseUrl).get('/text', { type });
    expect(response.data).toBe(expected);
  });

  it('transport:blob preserves Blob bytes', async () => {
    fetchMock.mockResolvedValueOnce(new Response('blob bytes', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }));
    const response = await new ApiClient(baseUrl).get<Blob>('/blob', { type: 'blob' });
    expect(response.data).toBeInstanceOf(Blob);
    expect(await response.data?.text()).toBe('blob bytes');
  });

  it('transport:array-buffer preserves ArrayBuffer bytes', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const response = await new ApiClient(baseUrl).get<ArrayBuffer>('/bytes', { type: 'arrayBuffer' });
    expect([...new Uint8Array(response.data ?? new ArrayBuffer(0))]).toEqual([1, 2, 3]);
  });

  it.each([204, 205])('transport:empty preserves %s with undefined data and metadata', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, {
      status,
      headers: { 'x-request-id': 'response-id' },
    }));
    const response = await new ApiClient(baseUrl).delete('/empty');
    expect(response).toMatchObject({ data: undefined, status });
    expect(response.headers.get('x-request-id')).toBe('response-id');
  });

  it('transport:body-init preserves direct request BodyInit values byte-for-byte', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient(baseUrl);
    const formData = new FormData();
    formData.append('name', 'fixture');
    const values: BodyInit[] = [
      'raw text',
      new URLSearchParams({ key: 'value' }),
      new Blob(['blob']),
      new Uint8Array([4, 5]).buffer,
      formData,
    ];

    for (const body of values) {
      await client.request('/body', { method: 'POST', body });
    }

    expect(fetchMock.mock.calls.map(([, init]) => init.body)).toEqual(values);
  });

  it('transport:convenience-body characterizes JSON/FormData support and string corruption', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient(baseUrl);
    const formData = new FormData();
    formData.append('name', 'fixture');

    await client.post('/json', { value: 1 });
    await client.post('/form', formData);
    await client.post('/string', 'raw text');

    expect(fetchMock.mock.calls[0]?.[1].body).toBe('{"value":1}');
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(formData);
    expect(fetchMock.mock.calls[2]?.[1].body).toBe('"raw text"');
  });

  it('defect:settings-delete-config-body characterizes the legacy misuse that the repository no longer performs', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await new ApiClient(baseUrl).delete('/sessions/1', { type: 'text' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/sessions/1`,
      expect.objectContaining({ method: 'DELETE', body: '{"type":"text"}' }),
    );
  });

  it('transport:credentials-include and transport:credentials-omit preserve explicit cookie policy', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient(baseUrl);
    await client.get('/private');
    await client.get('/public', { credentials: 'omit' });

    expect(fetchMock.mock.calls[0]?.[1].credentials).toBe('include');
    expect(fetchMock.mock.calls[1]?.[1].credentials).toBe('omit');
  });

  it('rejects an absolute URL outside the configured service before attaching inherited auth', async () => {
    const injectedFetch = vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = createInvestDataClient({
      baseUrl,
      fetch: injectedFetch,
      hooks: {
        getAuthHeaders: () => ({
          authorization: 'Bearer current-user',
          'x-current-app-key': 'current-application',
        }),
      },
    });

    await expect(
      client.get('https://external.example.test/resource', { credentials: 'omit' }),
    ).rejects.toMatchObject({
      cause: { name: 'SdkConfigurationError' },
    });
    expect(injectedFetch).not.toHaveBeenCalled();
  });

  it('transport:simple suppresses all default non-simple headers', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await new ApiClient(baseUrl).get('/simple', {
      simple: true,
      headers: { accept: 'text/plain' },
    });
    expect(fetchMock.mock.calls[0]?.[1].headers).toEqual({ accept: 'text/plain' });
  });

  it('transport:request-id preserves generated and caller-overridden IDs', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const client = new ApiClient(baseUrl);
    await client.get('/generated');
    await client.get('/custom', { headers: { 'X-Request-ID': 'custom-id' } });

    expect(fetchMock.mock.calls[0]?.[1].headers['X-Request-ID']).toBe('generated-request-id');
    expect(fetchMock.mock.calls[1]?.[1].headers['X-Request-ID']).toBe('custom-id');
  });

  it.each([
    ['transport:read-retry', 'GET'],
    ['transport:options-schema', 'OPTIONS'],
  ] as const)('%s retries one network failure and reuses the logical request ID', async (_testId, method) => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    const client = new ApiClient(baseUrl);
    if (method === 'OPTIONS') {
      await client.options('/schema', { retryDelayMs: 0 });
      expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/schema?schema=1`);
    } else {
      await client.get('/read', { retryDelayMs: 0 });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1].headers['X-Request-ID']).toBe('generated-request-id');
    expect(fetchMock.mock.calls[1]?.[1].headers['X-Request-ID']).toBe('generated-request-id');
  });

  it('transport:mutation-no-retry keeps mutations single-attempt by default', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const promise = new ApiClient(baseUrl).post('/mutation', { value: 1 });
    await expect(promise).rejects.toBeInstanceOf(NetworkRequestError);
    await expect(promise).rejects.toMatchObject({ data: { retryable: false, attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('transport:abort preserves the caller abort and performs no retry', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('aborted', 'AbortError');
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw abortError;
    });
    const promise = new ApiClient(baseUrl).get('/abort', { signal: controller.signal });
    await expect(promise).rejects.toBe(abortError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('transport:timeout preserves the canonical timeout signal through the compatibility fetch', async () => {
    const pendingFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      })
    ));

    await expect(executeCanonicalCompatibilityRequest({
      url: `${baseUrl}/timeout`,
      method: 'GET',
      headers: {},
      credentials: 'include',
      responseMode: 'json',
      timeoutMs: 5,
      fetch: pendingFetch,
    })).rejects.toBeInstanceOf(SdkTimeoutError);
    expect(pendingFetch).toHaveBeenCalledTimes(1);
  });

  it('transport:timeout keeps timeout identity and does not return an offline cache hit', async () => {
    const readOfflineResponse = vi.fn().mockResolvedValue({
      data: { cached: true },
      status: 200,
      headers: new Headers(),
    });
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      readOfflineResponse: readOfflineResponse as ApiClientHooks['readOfflineResponse'],
    });
    const pendingFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      })
    ));

    await expect(new ApiClient(baseUrl, { fetch: pendingFetch }).get('/timeout-cache', {
      timeoutMs: 5,
      retry: 0,
    })).rejects.toBeInstanceOf(SdkTimeoutError);
    expect(readOfflineResponse).not.toHaveBeenCalled();
  });

  it('transport:dedupe is opt-in and separates authorization scopes and mutations', async () => {
    let resolveRead: ((response: Response) => void) | undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRead = resolve; }))
      .mockImplementation(async () => new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    let authScope = 'session-one';
    const client = new ApiClient(baseUrl, {
      deduplicateSafeReads: true,
      deduplicationScope: () => authScope,
    });
    const readOne = client.get('/same', { headers: { authorization: 'Bearer one' } });
    authScope = 'session-two';
    const readTwo = client.get('/same', { headers: { authorization: 'Bearer two' } });
    await vi.waitFor(() => expect(resolveRead).toBeTypeOf('function'));
    resolveRead?.(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await Promise.all([readOne, readTwo]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await Promise.all([
      client.post('/same', { order: 1 }),
      client.post('/same', { order: 2 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('transport:dedupe shares only explicitly enabled reads in the same auth scope', async () => {
    let resolveRead: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRead = resolve; }));
    const client = new ApiClient(baseUrl, {
      deduplicateSafeReads: true,
      deduplicationScope: () => 'profile-7',
    });

    const first = client.get('/same');
    const second = client.get('/same');
    await vi.waitFor(() => expect(resolveRead).toBeTypeOf('function'));
    resolveRead?.(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('runtime:offline-read gives pre-abort precedence over a cache hit', async () => {
    const controller = new AbortController();
    const abortReason = new DOMException('cancelled', 'AbortError');
    controller.abort(abortReason);
    const cachedResponse = {
      data: { cached: true },
      status: 200,
      headers: new Headers(),
    };
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      readOfflineResponse: async <T>() => cachedResponse as unknown as {
        data: T;
        status: number;
        headers: Headers;
      },
    });
    await expect(new ApiClient(baseUrl).get('/cached', { signal: controller.signal }))
      .rejects
      .toBe(abortReason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runtime:offline-read gives an abort during cache lookup precedence over the cache hit', async () => {
    const controller = new AbortController();
    const abortReason = new DOMException('logout', 'AbortError');
    let resolveCache: ((value: {
      data: { cached: boolean };
      status: number;
      headers: Headers;
    }) => void) | undefined;
    const cacheLookup = new Promise<{
      data: { cached: boolean };
      status: number;
      headers: Headers;
    }>((resolve) => { resolveCache = resolve; });
    const readOfflineResponse = vi.fn(() => cacheLookup);
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      readOfflineResponse: readOfflineResponse as ApiClientHooks['readOfflineResponse'],
    });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    const request = new ApiClient(baseUrl).get('/cached-race', {
      signal: controller.signal,
      retry: 1,
      retryDelayMs: 0,
    });
    await vi.waitFor(() => expect(readOfflineResponse).toHaveBeenCalledOnce());
    controller.abort(abortReason);
    resolveCache?.({ data: { cached: true }, status: 200, headers: new Headers() });

    await expect(request).rejects.toBe(abortReason);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('transport:retry aborts immediately during backoff and does not start another attempt', async () => {
    const controller = new AbortController();
    const abortReason = new DOMException('cancel retry', 'AbortError');
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));

    const request = new ApiClient(baseUrl).get('/retry-abort', {
      signal: controller.signal,
      retry: 1,
      retryDelayMs: 60_000,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort(abortReason);

    await expect(request).rejects.toBe(abortReason);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('runtime:offline-read and transport:offline-headers persist reads with hydration metadata', async () => {
    const persistOfflineResponse = vi.fn().mockResolvedValue(undefined);
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      persistOfflineResponse,
      offlineResponseSourceHeader: 'x-source',
      offlineLastSyncHeader: 'x-last-sync',
    });
    fetchMock.mockResolvedValueOnce(new Response('{"fresh":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await new ApiClient(baseUrl).get('/persisted');
    expect(response.headers.get('x-source')).toBe('network');
    expect(response.headers.get('x-last-sync')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(persistOfflineResponse).toHaveBeenCalledOnce();
  });

  it('runtime:offline persistence failures do not discard a usable network response', async () => {
    const persistenceError = new Error('IndexedDB write failed');
    const reportOfflinePolicyError = vi.fn();
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      persistOfflineResponse: vi.fn().mockRejectedValue(persistenceError),
      reportOfflinePolicyError,
    });
    fetchMock.mockResolvedValueOnce(new Response('{"fresh":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(new ApiClient(baseUrl).get('/persist-failure')).resolves.toMatchObject({
      data: { fresh: true },
      status: 200,
    });
    expect(reportOfflinePolicyError).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'persist',
      error: persistenceError,
      requestUrl: `${baseUrl}/persist-failure`,
    }));
  });

  it('runtime:offline storage read failures are reported and continue to the safe-read retry', async () => {
    const storageError = new Error('corrupted IndexedDB entry');
    const reportOfflinePolicyError = vi.fn();
    configureApiClientHooks({
      matchOfflinePolicy: () => ({ persistToIndexedDb: true }),
      readOfflineResponse: vi.fn().mockRejectedValue(storageError),
      reportOfflinePolicyError,
    });
    fetchMock
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('{"fresh":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    await expect(new ApiClient(baseUrl).get('/read-failure', {
      retryDelayMs: 0,
    })).resolves.toMatchObject({ data: { fresh: true }, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reportOfflinePolicyError).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'read',
      error: storageError,
    }));
  });

  it('runtime:offline-mutation blocks writes before fetch unless explicitly overridden', async () => {
    configureApiClientHooks({ isOnline: () => false });
    const client = new ApiClient(baseUrl);
    await expect(client.post('/blocked', {})).rejects.toBeInstanceOf(OfflineRequestError);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await expect(client.post('/allowed', {}, { allowOfflineMutation: true })).resolves.toMatchObject({ status: 200 });
  });

  it('transport:pagination derives x-total-count metadata', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-total-count': '21' },
    }));
    const response = await new ApiClient(baseUrl).getPaginated('/items', 2, 10);
    expect(response.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 21,
      itemsPerPage: 10,
    });
  });

  it('transport:server-alert-flag and transport:fatal-flag preserve compatibility projections', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"failed"}', {
      status: 500,
      headers: { 'content-type': 'application/json' },
    }));
    const promise = new ApiClient(baseUrl).get('/fatal', {
      fatalOnServerError: true,
      showGlobalAlertOnServerError: false,
    });
    await expect(promise).rejects.toMatchObject({
      isFatal: true,
      showGlobalAlertOnServerError: false,
      data: { statusCode: 500, responseJson: { message: 'failed' } },
    });
  });

  it('transport:api-error preserves consumed methods and sanitized request-body hook output', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"missing"}', {
      status: 404,
      headers: { 'content-type': 'application/json' },
    }));
    const promise = new ApiClient(baseUrl).post('/missing', { password: 'not-recorded' });
    let error: APIError | undefined;
    try {
      await promise;
    } catch (caught) {
      error = caught as APIError;
    }

    expect(error).toBeInstanceOf(APIError);
    expect(error?.isClientError()).toBe(true);
    expect(error?.isServerError()).toBe(false);
    expect(error?.getDetailedMessage()).toBe('missing');
    expect(error?.data.body).toEqual({ redacted: true });
    expect(JSON.stringify(error)).not.toContain('not-recorded');
  });
});
