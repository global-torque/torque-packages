import type { InvestAppConfig, InvestAppApiUrls } from '@global-torque/invest-core/app/config';
import { normalizeAnalyticsBodyForMethod } from '@global-torque/invest-core/analytics/analyticsBody';
import { NetworkRequestError } from './service/handlers/networkRequestError.ts';
import type { APIErrorData } from './service/handlers/apiError.ts';
import {
  SdkAbortError,
  SdkHttpError,
  SdkNetworkError,
  SdkResponseParseError,
} from '@global-torque/sdk';
import { executeCanonicalCompatibilityRequest } from './migration/canonicalCompatibilityTransport.ts';
import { resolveAllowedRedirectOrigins } from './migration/redirectOrigins.ts';
import {
  createCompatibilityDiagnosticHeaders,
  createCompatibilityHttpRequest,
  projectSdkHttpError,
  sanitizeCompatibilityUrl,
} from './migration/compatibilityErrorProjection.ts';

export type InvestDataHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type InvestDataRequestOptions = {
  method?: InvestDataHttpMethod;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

export type InvestDataRequestContext = {
  url: string;
  method: InvestDataHttpMethod;
  headers: Headers;
};

export type InvestDataClientHooks = {
  getAuthHeaders?: () => HeadersInit | Promise<HeadersInit>;
  onRequest?: (context: InvestDataRequestContext) => void | Promise<void>;
  onResponse?: (context: InvestDataRequestContext & { response: Response }) => void | Promise<void>;
  onError?: (context: InvestDataRequestContext & { error: unknown }) => void | Promise<void>;
};

export type InvestDataClientConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
  hooks?: InvestDataClientHooks;
  allowedRedirectOrigins?: readonly string[];
  allowInsecureOrigins?: readonly string[];
  signal?: AbortSignal;
};

export class InvestDataHttpError extends Error {
  readonly status: number;

  readonly statusCode: number;

  readonly response: Response;

  /** Untrusted application-protocol data. Validate before use; do not log directly. */
  readonly data: unknown;

  readonly httpRequest: APIErrorData['httpRequest'];

  readonly body: APIErrorData['body'];

  constructor(
    response: Response,
    data: unknown,
    httpRequest: APIErrorData['httpRequest'],
    body: APIErrorData['body'],
  ) {
    super(`Invest data request failed with status ${response.status}`);
    this.name = 'InvestDataHttpError';
    this.status = response.status;
    this.statusCode = response.status;
    this.response = response;
    Object.defineProperty(this, 'data', {
      configurable: false,
      enumerable: false,
      value: data,
      writable: false,
    });
    this.httpRequest = httpRequest;
    this.body = body;
  }
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const isBodyInit = (value: unknown): value is BodyInit =>
  typeof value === 'string' ||
  (typeof FormData !== 'undefined' && value instanceof FormData) ||
  (typeof Blob !== 'undefined' && value instanceof Blob) ||
  (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) ||
  (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer);

const appendQuery = (url: URL, query?: InvestDataRequestOptions['query']) => {
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.set(key, String(value));
  });
};

const cloneResponse = (response: Response): Response =>
  typeof response.clone === 'function' ? response.clone() : response;

const mergeHeaders = async (headers: HeadersInit | undefined, hooks?: InvestDataClientHooks) => {
  const mergedHeaders = new Headers({
    accept: 'application/json',
  });

  const authHeaders = await hooks?.getAuthHeaders?.();
  new Headers(authHeaders).forEach((value, key) => mergedHeaders.set(key, value));
  new Headers(headers).forEach((value, key) => mergedHeaders.set(key, value));

  return mergedHeaders;
};

const isAbortError = (error: unknown, signal?: AbortSignal): boolean =>
  signal?.aborted === true ||
  (typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError');

const combineAbortSignals = (
  requestSignal?: AbortSignal,
  clientSignal?: AbortSignal,
): AbortSignal | undefined => {
  const signals = [requestSignal, clientSignal].filter(Boolean) as AbortSignal[];
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
};

export const createInvestDataClient = ({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
  hooks,
  allowedRedirectOrigins = [],
  allowInsecureOrigins = [],
  signal: clientSignal,
}: InvestDataClientConfig) => {
  if (!fetchImpl) {
    throw new Error('A fetch implementation is required to create invest-data clients.');
  }

  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  const buildUrl = (path: string, query?: InvestDataRequestOptions['query']) => {
    const url = path.startsWith('http')
      ? new URL(path)
      : new URL(`${normalizedBaseUrl}${normalizePath(path)}`);
    appendQuery(url, query);
    return url.toString();
  };

  const request = async <T>(path: string, options: InvestDataRequestOptions = {}): Promise<T> => {
    const method = options.method ?? 'GET';
    const signal = combineAbortSignals(options.signal, clientSignal);
    const url = buildUrl(path, options.query);
    const headers = await mergeHeaders(options.headers, hooks);
    const hasJsonBody = options.body !== undefined && !isBodyInit(options.body);
    if (hasJsonBody && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const context = {
      url: sanitizeCompatibilityUrl(url),
      method,
      headers: createCompatibilityDiagnosticHeaders(headers),
    };
    const httpRequest = createCompatibilityHttpRequest(method, url);
    const requestBody = normalizeAnalyticsBodyForMethod(method, options.body);
    await hooks?.onRequest?.(context);

    let capturedResponse: Response | undefined;
    let fetchError: unknown;
    let responseHookCalled = false;
    try {
      const result = await executeCanonicalCompatibilityRequest<T>({
        url,
        serviceBaseUrl: baseUrl,
        method,
        headers,
        credentials: options.credentials ?? 'include',
        signal,
        body: method === 'GET' ? undefined : options.body,
        responseMode: 'auto',
        headerPolicy: 'caller',
        fetch: fetchImpl,
        retry: { maxRetries: 0, delayMs: 0 },
        allowedRedirectOrigins,
        allowInsecureOrigins,
        onFetchResponse: (response) => {
          capturedResponse = response;
        },
        onFetchError: (error) => {
          fetchError = error;
        },
      });
      if (capturedResponse) {
        responseHookCalled = true;
        await hooks?.onResponse?.({
          ...context,
          response: cloneResponse(capturedResponse),
        });
      }
      return result.data;
    } catch (error) {
      if (capturedResponse && !responseHookCalled) {
        responseHookCalled = true;
        await hooks?.onResponse?.({
          ...context,
          response: cloneResponse(capturedResponse),
        });
      }

      let reportedError: unknown;
      if (error instanceof SdkHttpError) {
        const projection = projectSdkHttpError(error);
        reportedError = new InvestDataHttpError(
          projection.response,
          projection.responseBody,
          httpRequest,
          requestBody,
        );
      } else if (error instanceof SdkAbortError || isAbortError(fetchError ?? error, signal)) {
        reportedError = fetchError ?? signal?.reason ?? error;
      } else if (error instanceof SdkResponseParseError) {
        reportedError = new NetworkRequestError(
          new SyntaxError('Unexpected token in JSON response'),
          httpRequest,
          requestBody,
          { retryable: method === 'GET', attempts: 1 },
        );
      } else if (error instanceof SdkNetworkError) {
        reportedError = new NetworkRequestError(fetchError ?? error, httpRequest, requestBody, {
          retryable: method === 'GET',
          attempts: 1,
        });
      } else {
        reportedError = new NetworkRequestError(error, httpRequest, requestBody, {
          retryable: method === 'GET',
          attempts: 1,
        });
      }

      await hooks?.onError?.({ ...context, error: reportedError });
      throw reportedError;
    }
  };

  return {
    request,
    get: <T>(path: string, options?: Omit<InvestDataRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(
      path: string,
      body?: unknown,
      options?: Omit<InvestDataRequestOptions, 'method' | 'body'>,
    ) => request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(
      path: string,
      body?: unknown,
      options?: Omit<InvestDataRequestOptions, 'method' | 'body'>,
    ) => request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(
      path: string,
      body?: unknown,
      options?: Omit<InvestDataRequestOptions, 'method' | 'body'>,
    ) => request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(
      path: string,
      body?: unknown,
      options?: Omit<InvestDataRequestOptions, 'method' | 'body'>,
    ) => request<T>(path, { ...options, method: 'DELETE', body }),
  };
};

export type InvestDataClient = ReturnType<typeof createInvestDataClient>;

export const createInvestDataClientFromAppConfig = (
  appConfig: InvestAppConfig,
  apiName: keyof InvestAppApiUrls,
  options: Omit<InvestDataClientConfig, 'baseUrl'> = {},
) =>
  createInvestDataClient({
    ...options,
    baseUrl: String(appConfig.urls.api[apiName] ?? ''),
    allowedRedirectOrigins:
      options.allowedRedirectOrigins ??
      resolveAllowedRedirectOrigins([
        appConfig.urls.frontend,
        appConfig.urls.dashboard,
        appConfig.urls.static,
      ]),
  });
