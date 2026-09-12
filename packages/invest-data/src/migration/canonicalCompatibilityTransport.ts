import {
  createInvestSdkTransport,
  type SdkHttpMethod,
  type SdkResponseMode,
  type SdkResult,
  type SdkUserAuthStrategy,
} from '@global-torque/sdk';
import { resolveAllowedRedirectOrigins } from './redirectOrigins.ts';

const CAPTURED_RESPONSE_HEADERS = new Set([
  'content-disposition',
  'content-type',
  'retry-after',
  'x-request-id',
  'x-total-count',
]);

const createResponseMetadata = (response: Response): Response => {
  const headers = new Headers();
  response.headers.forEach((value, name) => {
    if (CAPTURED_RESPONSE_HEADERS.has(name.toLowerCase())) headers.set(name, value.slice(0, 500));
  });
  return new Response(null, { status: response.status, headers });
};

const COMPATIBILITY_SERVICE = 'legacy-compatibility';

const createCompatibilityRequestId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `legacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export type CanonicalCompatibilityRequest = {
  url: string;
  serviceBaseUrl?: string;
  method: SdkHttpMethod;
  headers: HeadersInit;
  credentials: RequestCredentials;
  body?: unknown;
  responseMode: SdkResponseMode;
  requestId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number | null;
  fetch: typeof fetch;
  retry?: {
    maxRetries?: number;
    delayMs?: number;
  };
  headerPolicy?: 'standard' | 'caller';
  fetchHeaderShape?: 'headers' | 'record';
  allowedRedirectOrigins?: readonly string[];
  allowInsecureOrigins?: readonly string[];
  onFetchResponse?: (response: Response) => void;
  onFetchError?: (error: unknown) => void;
};

const authFor = (
  credentials: RequestCredentials,
  authorization: string | null,
): SdkUserAuthStrategy => {
  if (authorization !== null) {
    return {
      kind: 'authorization',
      getAuthorization: () => authorization,
      credentials,
    };
  }
  if (credentials === 'omit') return { kind: 'none', credentials };
  return { kind: 'cookie', credentials };
};

export const executeCanonicalCompatibilityRequest = async <T>({
  url,
  serviceBaseUrl,
  method,
  headers: inputHeaders,
  credentials,
  body,
  responseMode,
  requestId: explicitRequestId,
  idempotencyKey,
  signal,
  timeoutMs = null,
  fetch: fetchImplementation,
  retry = { maxRetries: 0, delayMs: 0 },
  headerPolicy = 'standard',
  fetchHeaderShape = 'headers',
  allowInsecureOrigins = [],
  onFetchResponse,
  onFetchError,
}: CanonicalCompatibilityRequest): Promise<SdkResult<T>> => {
  const parsedUrl = new URL(url);
  const parsedServiceBaseUrl = new URL(serviceBaseUrl ?? url, parsedUrl);
  const allowedInsecureOrigins = resolveAllowedRedirectOrigins(allowInsecureOrigins).filter(
    (origin) => origin.startsWith('http:'),
  );
  const headers = new Headers(inputHeaders);
  const authorization = headers.get('authorization');
  const applicationKey = headers.get('x-api-key') ?? undefined;
  const requestId = explicitRequestId ?? headers.get('x-request-id') ?? undefined;
  headers.delete('authorization');
  headers.delete('x-api-key');
  headers.delete('x-request-id');

  const originalHeaderNames = new Map<string, string>();
  if (Array.isArray(inputHeaders)) {
    for (const [name] of inputHeaders) originalHeaderNames.set(name.toLowerCase(), name);
  } else if (inputHeaders instanceof Headers) {
    for (const [name] of inputHeaders) originalHeaderNames.set(name.toLowerCase(), name);
  } else {
    for (const name of Object.keys(inputHeaders)) originalHeaderNames.set(name.toLowerCase(), name);
  }

  const legacyHeaderName = (name: string) =>
    originalHeaderNames.get(name) ??
    {
      'content-type': 'Content-Type',
      'x-request-id': 'X-Request-ID',
      'x-api-key': 'X-API-Key',
    }[name] ??
    name;

  const captureFetch: typeof fetch = async (_input, init) => {
    try {
      const fetchHeaders = new Headers(init?.headers);
      const forwardedHeaders =
        fetchHeaderShape === 'record'
          ? Object.fromEntries(
              [...fetchHeaders.entries()].map(([name, value]) => [legacyHeaderName(name), value]),
            )
          : fetchHeaders;
      const forwardedInit: RequestInit = { ...init, headers: forwardedHeaders };
      // The canonical engine validates and resolves this URL, but the legacy
      // clients passed their original string to the injected Fetch function.
      // Preserve that observable contract (including pre-normalized path text)
      // at the temporary facade boundary.
      const response = await fetchImplementation(url, forwardedInit);
      // Hooks and compatibility mappers only need bounded response metadata.
      // Never retain a clone of an untrusted response body outside the SDK's
      // bounded private parse state.
      const capturedResponse = createResponseMetadata(response);
      if (capturedResponse) onFetchResponse?.(capturedResponse);
      return response;
    } catch (error) {
      onFetchError?.(error);
      throw error;
    }
  };

  const transport = createInvestSdkTransport({
    ...(applicationKey ? { apiKey: applicationKey } : {}),
    fetch: captureFetch,
    createRequestId: () => requestId ?? createCompatibilityRequestId(),
    retry: { maxRetries: 0, delayMs: 0 },
    allowInsecureOrigins:
      allowedInsecureOrigins.length > 0 ? [...new Set(allowedInsecureOrigins)] : undefined,
    services: {
      [COMPATIBILITY_SERVICE]: {
        baseUrl: (() => {
          const exactBase = new URL(parsedServiceBaseUrl);
          exactBase.search = '';
          exactBase.hash = '';
          if (!exactBase.pathname.endsWith('/')) exactBase.pathname = `${exactBase.pathname}/`;
          return exactBase.toString();
        })(),
        applicationAuth: applicationKey ? 'api-key' : 'none',
        auth: authFor(credentials, authorization),
        headerPolicy,
        // A custom application-key header is not guaranteed to be stripped by
        // Fetch across an origin-changing redirect. Keyed compatibility
        // requests therefore fail closed instead of forwarding it.
        redirectPolicy: applicationKey || authorization !== null ? 'error' : 'follow',
      },
    },
  });

  try {
    const result = await transport.createServiceClient(COMPATIBILITY_SERVICE).request({
      method,
      path: parsedUrl.toString(),
      headers,
      body,
      responseMode,
      requestId,
      idempotencyKey,
      signal,
      timeoutMs,
      retry,
    });
    // The legacy invest-data API lets callers select T without runtime
    // validation. Keep that unsound promise contained in this temporary
    // compatibility facade; the canonical SDK surface returns unknown unless a
    // validator proves a response type.
    return result as SdkResult<T>;
  } finally {
    transport.dispose();
  }
};
