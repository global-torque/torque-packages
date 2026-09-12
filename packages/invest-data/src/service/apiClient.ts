import {
  type ApiResponse, type RequestConfig,
} from './types.ts';
import { APIError } from './handlers/apiError.ts';
import { OfflineRequestError } from './handlers/offlineRequestError.ts';
import { NetworkRequestError } from './handlers/networkRequestError.ts';
import {
  getApiClientHooks,
  type ApiClientHooks,
} from './apiClientHooks.ts';
import {
  SdkAbortError,
  SdkConfigurationError,
  SdkHttpError,
  SdkNetworkError,
  SdkResponseParseError,
  SdkTimeoutError,
  type SdkHttpMethod,
  type SdkResponseMode,
} from '@global-torque/sdk';
import { executeCanonicalCompatibilityRequest } from '../migration/canonicalCompatibilityTransport.ts';
import {
  createCompatibilityHttpRequest,
  projectSdkHttpError,
} from '../migration/compatibilityErrorProjection.ts';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENT_METHODS = new Set(['GET', 'OPTIONS']);
const DEFAULT_READ_NETWORK_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 250;

const isAbortError = (error: unknown, signal?: AbortSignal | null): boolean => (
  signal?.aborted === true
  || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  || (error instanceof Error && error.name === 'AbortError')
);

const combineAbortSignals = (
  requestSignal?: AbortSignal | null,
  clientSignal?: AbortSignal | null,
): AbortSignal | undefined => {
  const signals = [requestSignal, clientSignal].filter(Boolean) as AbortSignal[];
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  throw signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
};

const waitForRetry = (ms: number, signal?: AbortSignal): Promise<void> => {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException('The request was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

const SENSITIVE_DEDUPE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key']);

const canonicalHeaders = (headers?: HeadersInit): readonly [string, string][] => (
  [...new Headers(headers).entries()]
    .map(([name, value]) => [
      name,
      SENSITIVE_DEDUPE_HEADERS.has(name.toLowerCase()) ? '<auth-scope>' : value,
    ] as [string, string])
    .sort(([left], [right]) => left.localeCompare(right))
);

const withOfflineMetaHeaders = (
  headers: Headers,
  meta: {
    source: 'network' | 'offline-cache';
    lastSyncedAt?: string | null;
  },
  headerNames: {
    source: string;
    lastSync: string;
  },
) => {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(headerNames.source, meta.source);
  if (meta.lastSyncedAt) {
    nextHeaders.set(headerNames.lastSync, meta.lastSyncedAt);
  }
  return nextHeaders;
};

const toSdkResponseMode = (type: RequestConfig['type']): SdkResponseMode => (
  type === 'stream' ? 'text' : type ?? 'auto'
);

const toPersistedPayloadType = (type: RequestConfig['type']) => {
  switch (type) {
    case 'json':
    case 'blob':
    case 'arrayBuffer':
      return type;
    case 'stream':
    case 'text':
    default:
      return 'text';
  }
};

export class ApiClient {
  private baseURL: string;

  private pendingRequests = new Map<string, Promise<ApiResponse<unknown>>>();

  private allowedRedirectOrigins: readonly string[];

  private allowInsecureOrigins: readonly string[];

  private hooks: ApiClientHooks | (() => ApiClientHooks) | undefined;

  private fetchImpl: typeof fetch | undefined;

  private signal: AbortSignal | undefined;

  private deduplicateSafeReads: boolean;

  private deduplicationScope: (() => string | null | undefined) | undefined;

  private applicationKey: string | undefined;

  private applicationKeyOrigin: string | undefined;

  constructor(
    baseURL: string = '',
    options: {
      allowedRedirectOrigins?: readonly string[];
      allowInsecureOrigins?: readonly string[];
      hooks?: ApiClientHooks | (() => ApiClientHooks);
      fetch?: typeof fetch;
      signal?: AbortSignal;
      deduplicateSafeReads?: boolean;
      deduplicationScope?: () => string | null | undefined;
      applicationKey?: string;
    } = {},
  ) {
    this.baseURL = baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
    this.allowedRedirectOrigins = [...(options.allowedRedirectOrigins ?? [])];
    this.allowInsecureOrigins = [...(options.allowInsecureOrigins ?? [])];
    this.hooks = options.hooks;
    this.fetchImpl = options.fetch;
    this.signal = options.signal;
    this.deduplicateSafeReads = options.deduplicateSafeReads === true;
    this.deduplicationScope = options.deduplicationScope;
    this.applicationKey = options.applicationKey;
    if (this.applicationKey !== undefined) {
      try {
        this.applicationKeyOrigin = new URL(
          this.baseURL,
          typeof window !== 'undefined' ? window.location.origin : undefined,
        ).origin;
      }
      catch {
        throw new SdkConfigurationError(
          'SDK_APPLICATION_KEY_ORIGIN_INVALID',
          'A keyed compatibility client requires an absolute service origin.',
        );
      }
    }
  }

  private getHooks(): ApiClientHooks {
    return typeof this.hooks === 'function' ? this.hooks() : this.hooks ?? getApiClientHooks();
  }

  private buildFullUrl(url: string, config: RequestConfig): string {
    const baseUrl = config.baseURL || this.baseURL;
    let fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    if (config.params && Object.keys(config.params).length > 0) {
      const urlWithParams = new URL(fullUrl);
      for (const [key, value] of Object.entries(config.params)) {
        if (value != null) urlWithParams.searchParams.set(key, String(value));
      }
      fullUrl = urlWithParams.toString();
    }
    return fullUrl;
  }

  private async executeRequest<T>(fullUrl: string, config: RequestConfig): Promise<ApiResponse<T>> {
    const isFormData = config.body instanceof FormData;
    const isSimple = config.simple === true;
    const method = (config.method || 'GET').toUpperCase();
    const hooks = this.getHooks();
    const signal = combineAbortSignals(config.signal, this.signal);
    throwIfAborted(signal);
    const fetchImpl = this.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error('A fetch implementation is required to make an API request.');
    }
    const offlinePolicy = hooks.matchOfflinePolicy(fullUrl, method);

    const reportOfflinePolicyError = async (
      phase: 'read' | 'read-metadata' | 'persist',
      error: unknown,
    ) => {
      if (!offlinePolicy || !hooks.reportOfflinePolicyError) return;
      try {
        await hooks.reportOfflinePolicyError({
          phase,
          error,
          policy: offlinePolicy,
          requestUrl: fullUrl,
        });
      }
      catch {
        // Offline diagnostics must never replace the request's transport outcome.
      }
    };

    const readOfflineMetadata = async () => {
      if (!offlinePolicy) return null;
      try {
        return await hooks.readOfflineResponseMetadata(offlinePolicy, fullUrl);
      }
      catch (error) {
        await reportOfflinePolicyError('read-metadata', error);
        return null;
      }
    };
    const clientRequestId = hooks.createRequestId();
    const defaultHeaders: Record<string, string> = {
      accept: 'application/json',
      'X-Request-ID': clientRequestId,
    };

    if (!isFormData && !isSimple) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const customHeaders = config.headers
      ? (config.headers instanceof Headers
          ? Object.fromEntries(config.headers.entries())
          : Array.isArray(config.headers)
            ? Object.fromEntries(config.headers as [string, string][])
            : (config.headers as Record<string, string>))
      : {};
    const callerHeaders = new Headers(customHeaders);
    if (this.applicationKey !== undefined && callerHeaders.has('x-api-key')) {
      throw new SdkConfigurationError(
        'SDK_APPLICATION_KEY_HEADER_OVERRIDE',
        'Caller headers must not override the context-owned application key.',
      );
    }
    const headers: Record<string, string> = isSimple ? customHeaders : { ...defaultHeaders, ...customHeaders };
    if (this.applicationKey !== undefined) {
      let requestOrigin: string;
      try {
        requestOrigin = new URL(fullUrl).origin;
      }
      catch {
        throw new SdkConfigurationError(
          'SDK_APPLICATION_KEY_REQUEST_URL_INVALID',
          'A keyed compatibility request requires an absolute URL.',
        );
      }
      if (requestOrigin !== this.applicationKeyOrigin) {
        throw new SdkConfigurationError(
          'SDK_APPLICATION_KEY_ORIGIN_MISMATCH',
          'The context-owned application key cannot be sent to a different origin.',
        );
      }
      headers['X-API-Key'] = this.applicationKey;
    }

    // Control how 5xx responses are treated by the global error handler.
    // By default, server errors are NOT considered fatal to avoid
    // redirecting the whole app for recoverable API issues.
    const fatalOnServerError = config.fatalOnServerError ?? false;
    const maxNetworkRetries = config.retry ?? (
      IDEMPOTENT_METHODS.has(method) ? DEFAULT_READ_NETWORK_RETRIES : 0
    );
    const retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    // Gather HTTP request data
    const requestBody = hooks.normalizeAnalyticsBodyForMethod(method, config.body);
    const httpRequest = createCompatibilityHttpRequest(method, fullUrl);

    if (MUTATION_METHODS.has(method) && !config.allowOfflineMutation && !hooks.isOnline()) {
      throw new OfflineRequestError(method, fullUrl);
    }

    let result: ApiResponse<T>;
    let attempt = 0;
    while (true) {
      let fetchError: unknown;
      try {
        const response = await executeCanonicalCompatibilityRequest<T>({
          url: fullUrl,
          credentials: config.credentials ?? 'include',
          method: method as SdkHttpMethod,
          body: method === 'GET' ? undefined : config.body ?? undefined,
          headers,
          idempotencyKey: config.idempotencyKey,
          signal,
          timeoutMs: config.timeoutMs,
          responseMode: toSdkResponseMode(config.type),
          fetch: fetchImpl,
          retry: { maxRetries: 0, delayMs: 0 },
          headerPolicy: isSimple ? 'caller' : 'standard',
          fetchHeaderShape: 'record',
          allowedRedirectOrigins: this.allowedRedirectOrigins,
          allowInsecureOrigins: this.allowInsecureOrigins,
          onFetchError: (error) => {
            fetchError = error;
          },
        });
        result = {
          data: response.data,
          status: response.status,
          headers: response.headers,
          attempts: attempt + 1,
          clientRequestId,
        };
        break;
      } catch (error) {
        if (error instanceof SdkTimeoutError) throw error;
        const aborted = error instanceof SdkAbortError || isAbortError(fetchError ?? error, signal);
        if (aborted) {
          throw fetchError ?? signal?.reason ?? error;
        }

        if (
          fetchError !== undefined
          && offlinePolicy?.persistToIndexedDb
          && config.offlineFallback !== false
        ) {
          try {
            const cached = await hooks.readOfflineResponse<T>(offlinePolicy, fullUrl);
            throwIfAborted(signal);
            if (cached) {
              return {
                data: cached.data,
                status: cached.status,
                headers: cached.headers,
                attempts: attempt + 1,
                clientRequestId,
              };
            }
          }
          catch (cacheError) {
            if (signal?.aborted) throw signal.reason ?? cacheError;
            await reportOfflinePolicyError('read', cacheError);
          }
          throwIfAborted(signal);
        }
        if (error instanceof SdkResponseParseError) {
          throw new SyntaxError('Unexpected token in JSON response');
        }
        if (error instanceof SdkHttpError) {
          const { response } = projectSdkHttpError(error);
          const apiError = new APIError('Failed to fetch data', response, httpRequest, requestBody);
          apiError.isFatal = fatalOnServerError && response.status >= 500;
          apiError.showGlobalAlertOnServerError = config.showGlobalAlertOnServerError ?? true;
          await apiError.initializeResponseJson();
          throw apiError;
        }

        const retryable = error instanceof SdkNetworkError && IDEMPOTENT_METHODS.has(method);
        if (!retryable || attempt >= maxNetworkRetries) {
          throw new NetworkRequestError(fetchError ?? error, httpRequest, requestBody, {
            retryable,
            attempts: attempt + 1,
          });
        }

        attempt += 1;
        if (retryDelayMs > 0) {
          await waitForRetry(retryDelayMs * attempt, signal);
        }
      }
    }

    if (result.status === 204 || result.status === 205) {
      const metadata = await readOfflineMetadata();
      return {
        data: undefined as T,
        status: result.status,
        headers: offlinePolicy
          ? withOfflineMetaHeaders(result.headers, {
              source: hooks.isOnline() ? 'network' : 'offline-cache',
              lastSyncedAt: hooks.isOnline() ? new Date().toISOString() : metadata?.lastSyncedAt ?? null,
            }, {
              source: hooks.offlineResponseSourceHeader,
              lastSync: hooks.offlineLastSyncHeader,
            })
          : result.headers,
        attempts: result.attempts,
        clientRequestId: result.clientRequestId,
      };
    }

    const type = config.type ?? (
      result.headers.get('content-type')?.includes('application/json') ? 'json' : 'text'
    );
    const data = result.data;

    let responseHeaders = result.headers;
    if (offlinePolicy?.persistToIndexedDb) {
      if (hooks.isOnline()) {
        const updatedAt = new Date().toISOString();
        try {
          await hooks.persistOfflineResponse(offlinePolicy, fullUrl, {
            data,
            status: result.status,
            headers: result.headers,
            payloadType: toPersistedPayloadType(type),
            updatedAt,
          });
        }
        catch (error) {
          await reportOfflinePolicyError('persist', error);
        }
        responseHeaders = withOfflineMetaHeaders(result.headers, {
          source: 'network',
          lastSyncedAt: updatedAt,
        }, {
          source: hooks.offlineResponseSourceHeader,
          lastSync: hooks.offlineLastSyncHeader,
        });
      } else {
        const metadata = await readOfflineMetadata();
        responseHeaders = withOfflineMetaHeaders(result.headers, {
          source: 'offline-cache',
          lastSyncedAt: metadata?.lastSyncedAt ?? null,
        }, {
          source: hooks.offlineResponseSourceHeader,
          lastSync: hooks.offlineLastSyncHeader,
        });
      }
    }

    return {
      data: data as T,
      status: result.status,
      headers: responseHeaders,
      attempts: result.attempts,
      clientRequestId: result.clientRequestId,
    };
  }

  async request<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const fullUrl = this.buildFullUrl(url, config);
    const method = (config.method || 'GET').toUpperCase();
    const credentials = config.credentials ?? 'include';
    const hasSensitiveCallerHeader = canonicalHeaders(config.headers)
      .some(([, value]) => value === '<auth-scope>');
    const needsAuthScope = credentials !== 'omit' || hasSensitiveCallerHeader;
    const authScope = this.deduplicationScope?.();
    const hasUsableAuthScope = typeof authScope === 'string' && authScope.trim().length > 0;
    const requestKey = JSON.stringify({
      method,
      url: fullUrl,
      headers: canonicalHeaders(config.headers),
      credentials,
      authScope: hasUsableAuthScope ? authScope : needsAuthScope ? null : 'public',
      type: config.type ?? 'auto',
      simple: config.simple === true,
      retry: config.retry,
      retryDelayMs: config.retryDelayMs,
      timeoutMs: config.timeoutMs,
      fatalOnServerError: config.fatalOnServerError,
      showGlobalAlertOnServerError: config.showGlobalAlertOnServerError,
    });
    const shouldDeduplicate = this.deduplicateSafeReads
      && (method === 'GET' || method === 'OPTIONS')
      && !config.signal
      && (!needsAuthScope || hasUsableAuthScope);

    if (shouldDeduplicate && this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey) as Promise<ApiResponse<T>>;
    }

    const promise = this.executeRequest<T>(fullUrl, config);
    if (shouldDeduplicate) {
      this.pendingRequests.set(requestKey, promise);
    }

    try {
      return await promise;
    } finally {
      if (shouldDeduplicate) {
        this.pendingRequests.delete(requestKey);
      }
    }
  }

  private static toBody(data?: unknown): BodyInit | undefined {
    if (data == null) return undefined;
    return data instanceof FormData ? data : JSON.stringify(data);
  }

  get<T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  post<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body: ApiClient.toBody(data) });
  }

  put<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body: ApiClient.toBody(data) });
  }

  patch<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', body: ApiClient.toBody(data) });
  }

  delete<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE', body: ApiClient.toBody(data) });
  }

  options<T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'OPTIONS',
      params: {
        ...config?.params,
        schema: 1,
      },
    });
  }

  async getPaginated<T>(
    url: string,
    page: number,
    limit: number,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T> & {
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
      }
    }> {
    const response = await this.get<T>(url, {
      ...config,
      params: {
        ...config?.params,
        page,
        limit,
      },
    });

    const totalItems = Number(response.headers.get('x-total-count')) || 0;
    const itemsPerPage = limit;

    return {
      ...response,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / itemsPerPage),
        totalItems,
        itemsPerPage,
      },
    };
  }
}
