import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createInvestSdkTransport,
  SdkValidationError,
  type SdkServiceClient,
} from '@global-torque/sdk';
import { ApiClient } from '../apiClient.ts';
import { APIError } from '../handlers/apiError.ts';
import {
  configureApiClientHooks,
  resetApiClientHooks,
} from '../apiClientHooks.ts';

const BASE_URL = 'https://api.example.test/v1.0';

type CapturedRequest = {
  url: string;
  method: string;
  credentials?: RequestCredentials;
  headers: Record<string, string>;
  body: unknown;
};

const captureFetch = (responses: readonly (Response | Error)[]) => {
  const requests: CapturedRequest[] = [];
  let responseIndex = 0;
  const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
    const body = init?.body;
    requests.push({
      url: input instanceof URL ? input.href : String(input),
      method: init?.method ?? 'GET',
      credentials: init?.credentials,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: body instanceof FormData
        ? [...body.entries()].map(([key, value]) => [
            key,
            typeof value === 'string' ? value : `${value.name}:${value.type}:${value.size}`,
          ])
        : body,
    });
    const response = responses[responseIndex];
    responseIndex += 1;
    if (response instanceof Error) throw response;
    if (!response) throw new Error('Differential Fetch script exhausted.');
    return response.clone();
  });
  return { fetchImpl, requests };
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(
  JSON.stringify(body),
  {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  },
);

const normalizeRequest = (request: CapturedRequest) => ({
  ...request,
  headers: Object.fromEntries(
    Object.entries(request.headers)
      .filter(([name]) => ![
        'x-api-key',
        'x-request-id',
        ...(request.body === undefined ? ['content-type'] : []),
      ].includes(name))
      .sort(([left], [right]) => left.localeCompare(right)),
  ),
});

const createCanonicalClient = (fetchImpl: typeof fetch): SdkServiceClient => {
  const transport = createInvestSdkTransport({
    apiKey: 'synthetic-non-production-key',
    fetch: fetchImpl,
    createRequestId: () => 'canonical-request-id',
    retry: { maxRetries: 1, delayMs: 0 },
    services: {
      oracle: {
        baseUrl: BASE_URL,
        applicationAuth: 'api-key',
        auth: { kind: 'cookie', credentials: 'include' },
      },
    },
  });
  return transport.createServiceClient('oracle');
};

const installLegacyFetch = (fetchImpl: typeof fetch) => {
  configureApiClientHooks({
    createRequestId: () => 'legacy-request-id',
    isOnline: () => true,
  });
  vi.stubGlobal('fetch', fetchImpl);
  return new ApiClient(BASE_URL);
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetApiClientHooks();
});

describe('Phase 2 pre-cutover legacy/SDK differential oracle', () => {
  it('differential:url-json-envelope preserves GET URL, query, credentials, and result metadata', async () => {
    const responses = [jsonResponse({ value: 42 }, {
      headers: { 'x-contract': 'same' },
    })];
    const legacyScript = captureFetch(responses);
    const canonicalScript = captureFetch(responses);

    const legacy = await installLegacyFetch(legacyScript.fetchImpl)
      .get<{ value: number }>('/offers', { params: { page: 2, empty: '' } });
    const canonical = await createCanonicalClient(canonicalScript.fetchImpl)
      .get('/offers', { query: { page: 2, empty: '' } });

    expect({ data: canonical.data, status: canonical.status }).toEqual({
      data: legacy.data,
      status: legacy.status,
    });
    expect(canonical.headers.get('x-contract')).toBe(legacy.headers.get('x-contract'));
    expect(normalizeRequest(canonicalScript.requests[0]!)).toEqual(
      normalizeRequest(legacyScript.requests[0]!),
    );
  });

  it('differential:methods-bodies preserves JSON mutations and multipart boundaries', async () => {
    const scenarios = [
      {
        legacy: (client: ApiClient) => client.post('/profiles', { name: 'Ada' }),
        canonical: (client: SdkServiceClient) => client.post('/profiles', { name: 'Ada' }),
      },
      {
        legacy: (client: ApiClient, form: FormData) => client.patch('/documents/7', form),
        canonical: (client: SdkServiceClient, form: FormData) => client.patch('/documents/7', form),
      },
      {
        legacy: (client: ApiClient) => client.delete('/sessions/7', { reason: 'user' }),
        canonical: (client: SdkServiceClient) => client.delete('/sessions/7', { reason: 'user' }),
      },
    ] as const;

    for (const scenario of scenarios) {
      const legacyScript = captureFetch([jsonResponse({ ok: true })]);
      const canonicalScript = captureFetch([jsonResponse({ ok: true })]);
      const legacyForm = new FormData();
      legacyForm.append('document', new File(['pdf'], 'proof.pdf', { type: 'application/pdf' }));
      const canonicalForm = new FormData();
      canonicalForm.append('document', new File(['pdf'], 'proof.pdf', { type: 'application/pdf' }));

      const legacyResult = await scenario.legacy(
        installLegacyFetch(legacyScript.fetchImpl),
        legacyForm,
      );
      const canonicalResult = await scenario.canonical(
        createCanonicalClient(canonicalScript.fetchImpl),
        canonicalForm,
      );

      expect(canonicalResult.data).toEqual(legacyResult.data);
      expect(normalizeRequest(canonicalScript.requests[0]!)).toEqual(
        normalizeRequest(legacyScript.requests[0]!),
      );
      vi.unstubAllGlobals();
    }
  });

  it('differential:options preserves the ten-consumer schema=1 convention', async () => {
    const response = jsonResponse({ type: 'object' });
    const legacyScript = captureFetch([response]);
    const canonicalScript = captureFetch([response]);

    const legacy = await installLegacyFetch(legacyScript.fetchImpl).options('/auth/profile');
    const canonical = await createCanonicalClient(canonicalScript.fetchImpl)
      .options('/auth/profile', { schema: true });

    expect(canonical.data).toEqual(legacy.data);
    expect(normalizeRequest(canonicalScript.requests[0]!)).toEqual(
      normalizeRequest(legacyScript.requests[0]!),
    );
  });

  it('differential:empty preserves 204/205 envelopes', async () => {
    for (const status of [204, 205]) {
      const response = new Response(null, { status });
      const legacyScript = captureFetch([response]);
      const canonicalScript = captureFetch([response]);

      const legacy = await installLegacyFetch(legacyScript.fetchImpl).get('/empty');
      const canonical = await createCanonicalClient(canonicalScript.fetchImpl).get('/empty');

      expect({ data: canonical.data, status: canonical.status }).toEqual({
        data: legacy.data,
        status: legacy.status,
      });
      vi.unstubAllGlobals();
    }
  });

  it('differential:retry preserves one safe-read retry and no mutation retry', async () => {
    const cases = [
      {
        legacy: (client: ApiClient) => client.get('/retry'),
        canonical: (client: SdkServiceClient) => client.get('/retry'),
        expectedAttempts: 2,
        responses: [new TypeError('offline'), jsonResponse({ ok: true })],
      },
      {
        legacy: (client: ApiClient) => client.post('/no-retry', { value: 1 }),
        canonical: (client: SdkServiceClient) => client.post('/no-retry', { value: 1 }),
        expectedAttempts: 1,
        responses: [new TypeError('offline')],
      },
    ] as const;

    for (const scenario of cases) {
      const legacyScript = captureFetch(scenario.responses);
      const canonicalScript = captureFetch(scenario.responses);
      const legacyPromise = scenario.legacy(installLegacyFetch(legacyScript.fetchImpl));
      const canonicalPromise = scenario.canonical(createCanonicalClient(canonicalScript.fetchImpl));

      const [legacyOutcome, canonicalOutcome] = await Promise.allSettled([
        legacyPromise,
        canonicalPromise,
      ]);
      expect(canonicalOutcome.status).toBe(legacyOutcome.status);
      expect(legacyScript.requests).toHaveLength(scenario.expectedAttempts);
      expect(canonicalScript.requests).toHaveLength(scenario.expectedAttempts);
      vi.unstubAllGlobals();
    }
  });

  it('differential:bad-request preserves the complete protocol body for the compatibility projection', async () => {
    const responseBody = {
      email: ['Email is invalid'],
      password: ['Password is too short'],
      __error__: ['The request could not be completed'],
      csrf_token: 'must-never-survive',
      ui: {
        messages: [{ id: 7, type: 'error', text: 'Check the highlighted fields' }],
        nodes: [{
          attributes: { name: 'totp_code', value: '123456' },
          messages: [{ id: 8, type: 'error', text: 'The code is invalid' }],
        }],
      },
    };
    const legacyScript = captureFetch([jsonResponse(responseBody, { status: 400 })]);
    const canonicalScript = captureFetch([jsonResponse(responseBody, { status: 400 })]);

    const [legacyOutcome, canonicalOutcome] = await Promise.allSettled([
      installLegacyFetch(legacyScript.fetchImpl).post('/auth/profile', { email: 'invalid' }),
      createCanonicalClient(canonicalScript.fetchImpl).post(
        '/auth/profile',
        { email: 'invalid' },
        { operationId: 'profiles.update' },
      ),
    ]);

    expect(legacyOutcome.status).toBe('rejected');
    expect(canonicalOutcome.status).toBe('rejected');
    const legacyError = (legacyOutcome as PromiseRejectedResult).reason;
    const canonicalError = (canonicalOutcome as PromiseRejectedResult).reason;
    expect(legacyError).toBeInstanceOf(APIError);
    expect(canonicalError).toBeInstanceOf(SdkValidationError);
    expect(legacyError.data.statusCode).toBe(canonicalError.status);
    expect(canonicalError.responseBody).toEqual(responseBody);
    expect(JSON.stringify(canonicalError)).not.toContain('must-never-survive');
    expect(normalizeRequest(canonicalScript.requests[0]!)).toEqual(
      normalizeRequest(legacyScript.requests[0]!),
    );
  });

  it('differential:malformed-error retains HTTP status while canonical diagnostics mark parse failure', async () => {
    const malformed = new Response('{broken', {
      status: 422,
      headers: { 'content-type': 'application/json' },
    });
    const legacyScript = captureFetch([malformed]);
    const canonicalScript = captureFetch([malformed]);

    const [legacyOutcome, canonicalOutcome] = await Promise.allSettled([
      installLegacyFetch(legacyScript.fetchImpl).get('/malformed'),
      createCanonicalClient(canonicalScript.fetchImpl).get('/malformed'),
    ]);
    const legacyError = (legacyOutcome as PromiseRejectedResult).reason;
    const canonicalError = (canonicalOutcome as PromiseRejectedResult).reason;

    expect(legacyError).toBeInstanceOf(APIError);
    expect(legacyError.data).toMatchObject({ statusCode: 422, responseJson: null });
    expect(canonicalError).toBeInstanceOf(SdkValidationError);
    expect(canonicalError).toMatchObject({
      status: 422,
      bodyKind: 'malformed',
      responseBody: undefined,
    });
  });
});
