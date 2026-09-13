import { inject, provide, type App, type InjectionKey } from "vue";
import type { InvestAppConfig } from "@global-torque/invest-core/app/config";
import {
  cookieAuth,
  createInvestSdkTransport,
  type InvestSdkTransport,
  type SdkConvenienceRequestOptions,
  type SdkHttpMethod,
  type SdkOptionsRequestOptions,
  type SdkQueryValue,
  type SdkRequestInput,
  type SdkResponseData,
  type SdkResponseMode,
  type SdkResponseValidator,
  type SdkResult,
  type SdkRetryPolicy,
  type SdkServiceClient,
  type SdkServiceConfig,
  type SdkUserAuthStrategy,
  type SdkValidatedConvenienceRequestOptions,
  type SdkValidatedOptionsRequestOptions,
  type SdkValidatedRequestInput,
} from "@global-torque/sdk";
import {
  createAnalyticsResource,
  type AnalyticsResource,
} from "@global-torque/sdk/resources/analytics";
import {
  createEvmResource,
  type EvmResource,
} from "@global-torque/sdk/resources/evm";
import {
  createEsignResource,
  type EsignResource,
} from "@global-torque/sdk/resources/esign";
import {
  createInvestmentsResource,
  type InvestmentsResource,
} from "@global-torque/sdk/resources/investments";
import {
  createInvitationsResource,
  type InvitationsResource,
} from "@global-torque/sdk/resources/invitations";
import {
  createNotificationsResource,
  type NotificationsResource,
} from "@global-torque/sdk/resources/notifications";
import {
  createOffersResource,
  type OffersResource,
} from "@global-torque/sdk/resources/offers";
import {
  createVaultResource,
  type VaultResource,
} from "@global-torque/sdk/resources/vault";
import {
  ApiClient,
  createInvestDataClient,
  type ApiClientHooks,
  type InvestDataClientHooks,
} from "@global-torque/invest-data";
import {
  createInvestDataClientConfigFromAppConfig,
  type InvestDataApiKey,
  type InvestDataClientConfig,
} from "@global-torque/invest-data/service/dataClientConfig";
import { createDefaultApiClientHooks } from "./apiClientDefaultHooks.ts";
import { createPwaPolicyEnvFromInvestAppConfig } from "./config.ts";
import type { InvestRuntimeAdapters } from "./adapters.ts";
import { resolveInvestRuntimePrivateCachePartition } from "./adapters.ts";

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type InvestApplicationContextOptions = {
  appConfig: InvestAppConfig;
  adapters?: InvestRuntimeAdapters;
  apiClientHooks?: ApiClientHooks;
  rawClientHooks?: InvestDataClientHooks;
  applicationKey?: string;
  allowInsecureSdkOrigins?: readonly string[];
  fetch?: typeof fetch;
  onDispose?: () => void;
};

export type InvestApplicationContextFallbackSnapshot = {
  activeContextCount: number;
  totalFallbackResolutions: number;
  consumers: Readonly<Record<string, number>>;
};

export type InvestApplicationSdkServiceOptions = {
  applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]>;
  auth: SdkUserAuthStrategy;
  headerPolicy?: SdkServiceConfig["headerPolicy"];
  redirectPolicy?: SdkServiceConfig["redirectPolicy"];
  retry?: SdkRetryPolicy;
  offlinePolicy?: "none" | "runtime";
  /** `null` preserves legacy clients whose safe reads had no transport timeout. */
  timeoutMs?: number | null;
};

export class InvestApplicationContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvestApplicationContextError";
  }
}

export class InvestApplicationContextDisposedError extends InvestApplicationContextError {
  constructor() {
    super("The invest application context has been disposed.");
    this.name = "InvestApplicationContextDisposedError";
  }
}

const cloneAppConfig = (config: InvestAppConfig): InvestAppConfig => ({
  ...config,
  urls: {
    ...config.urls,
    api: { ...config.urls.api },
  },
  brand: { ...config.brand },
  demoAccount: config.demoAccount ? { ...config.demoAccount } : undefined,
  build: config.build ? { ...config.build } : undefined,
  thirdParty: { ...config.thirdParty },
});

const cloneDataConfig = (
  config: InvestDataClientConfig,
): InvestDataClientConfig => ({
  ...config,
  apiUrls: { ...(config.apiUrls ?? {}) },
  appUrls: { ...(config.appUrls ?? {}) },
  allowedRedirectOrigins: [...(config.allowedRedirectOrigins ?? [])],
  thirdParty: { ...(config.thirdParty ?? {}) },
});

const requestUrl = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : String(input);

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
  (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

const requestSignal = (
  input: RequestInfo | URL,
  init?: RequestInit,
): AbortSignal | null | undefined =>
  init?.signal ?? (input instanceof Request ? input.signal : undefined);

const throwIfRequestAborted = (signal?: AbortSignal | null): void => {
  if (!signal?.aborted) return;
  throw (
    signal.reason ?? new DOMException("The request was aborted.", "AbortError")
  );
};

const withOfflineHeaders = (
  response: Response,
  hooks: ApiClientHooks,
  source: "network" | "offline-cache",
  lastSyncedAt: string | null | undefined,
): Response => {
  const headers = new Headers(response.headers);
  headers.set(hooks.offlineResponseSourceHeader, source);
  if (lastSyncedAt) {
    headers.set(hooks.offlineLastSyncHeader, lastSyncedAt);
  } else {
    headers.delete(hooks.offlineLastSyncHeader);
  }
  return new Response(
    response.status === 204 || response.status === 205 ? null : response.body,
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
};

const responseFromOfflineData = (
  data: unknown,
  status: number,
  headers: Headers,
  hooks: ApiClientHooks,
  lastSyncedAt?: string,
): Response => {
  headers.set(hooks.offlineResponseSourceHeader, "offline-cache");
  if (lastSyncedAt) headers.set(hooks.offlineLastSyncHeader, lastSyncedAt);
  const contentType = headers.get("content-type") ?? "";
  let body: BodyInit | null;
  if (data === undefined || data === null || status === 204 || status === 205) {
    body = null;
  } else if (
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data) ||
    typeof data === "string"
  ) {
    body = data as BodyInit;
  } else {
    body = JSON.stringify(data);
    if (!contentType) headers.set("content-type", "application/json");
  }
  return new Response(body, { status, headers });
};

const resolveSdkRequestUrl = (
  baseUrl: string,
  path: string,
  query?: Readonly<Record<string, SdkQueryValue | readonly SdkQueryValue[]>>,
): string => {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`;
  const url = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(path)
    ? new URL(path, base)
    : new URL(path.replace(/^\/+/u, ""), base);

  for (const [key, rawValue] of Object.entries(query ?? {})) {
    if (Array.isArray(rawValue)) {
      url.searchParams.delete(key);
      for (const value of rawValue) {
        if (value === undefined) continue;
        url.searchParams.append(key, value === null ? "" : String(value));
      }
    } else if (rawValue !== undefined) {
      url.searchParams.set(key, rawValue === null ? "" : String(rawValue));
    }
  }
  return url.href;
};

const sdkPersistedPayloadType = (
  input: Readonly<{ responseMode?: SdkResponseMode }>,
  result: SdkResult<unknown>,
): "json" | "text" | "blob" | "arrayBuffer" => {
  if (input.responseMode === "blob") return "blob";
  if (input.responseMode === "arrayBuffer") return "arrayBuffer";
  if (input.responseMode === "text") return "text";
  if (
    input.responseMode === "json" ||
    /(?:^|[/+])json(?:$|\s*;)/iu.test(
      result.headers.get("content-type") ?? "",
    ) ||
    typeof result.data !== "string"
  ) {
    return "json";
  }
  return "text";
};

type RuntimeSdkRequestInput<T = unknown> = Omit<
  SdkRequestInput,
  "responseMode" | "responseValidator"
> & {
  responseMode?: SdkResponseMode;
  responseValidator?: SdkResponseValidator<T>;
};

type RuntimeSdkConvenienceRequestOptions<T = unknown> = Omit<
  RuntimeSdkRequestInput<T>,
  "method" | "path" | "body"
>;

type RuntimeSdkOptionsRequestOptions<T = unknown> =
  RuntimeSdkConvenienceRequestOptions<T> & {
    schema?: boolean;
  };

const deepFreeze = <T>(value: T): DeepReadonly<T> => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }

  Object.values(value).forEach((child) => deepFreeze(child));
  return Object.freeze(value) as DeepReadonly<T>;
};

const activeCompatibilityContexts = new Set<InvestApplicationContext>();
const compatibilityFallbackConsumers = new Map<string, number>();

export class InvestApplicationContext {
  readonly appConfig: DeepReadonly<InvestAppConfig>;

  readonly dataClientConfig: DeepReadonly<InvestDataClientConfig>;

  private runtimeAdapters: Readonly<InvestRuntimeAdapters>;

  private readonly apiClientHooks: ApiClientHooks;

  private readonly rawClientHooks: InvestDataClientHooks | undefined;

  private readonly fetchImpl: typeof fetch | undefined;

  private readonly applicationKey: string | undefined;

  private readonly allowInsecureSdkOrigins: readonly string[];

  private readonly onDispose: (() => void) | undefined;

  private readonly sdkTransports = new Set<InvestSdkTransport>();

  private readonly sdkServiceClients = new Map<string, SdkServiceClient>();

  private readonly sdkFunctionIds = new WeakMap<
    (...args: never[]) => unknown,
    number
  >();

  private nextSdkFunctionId = 1;

  private disposed = false;

  private readonly abortController = new AbortController();

  constructor(options: InvestApplicationContextOptions) {
    const appConfig = cloneAppConfig(options.appConfig);
    const dataClientConfig =
      createInvestDataClientConfigFromAppConfig(appConfig);

    this.appConfig = deepFreeze(appConfig);
    this.dataClientConfig = deepFreeze(cloneDataConfig(dataClientConfig));
    this.runtimeAdapters = Object.freeze({ ...(options.adapters ?? {}) });
    this.apiClientHooks = Object.freeze(
      options.apiClientHooks ??
        createDefaultApiClientHooks({
          pwaPolicyEnv: createPwaPolicyEnvFromInvestAppConfig(appConfig),
          getPrivateCachePartition: () =>
            resolveInvestRuntimePrivateCachePartition(this.runtimeAdapters),
        }),
    );
    this.rawClientHooks = options.rawClientHooks
      ? Object.freeze({ ...options.rawClientHooks })
      : undefined;
    this.fetchImpl = options.fetch;
    this.applicationKey = options.applicationKey;
    this.allowInsecureSdkOrigins = Object.freeze([
      ...(options.allowInsecureSdkOrigins ?? []),
    ]);
    this.onDispose = options.onDispose;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  assertActive(): void {
    if (this.disposed) {
      throw new InvestApplicationContextDisposedError();
    }
  }

  getAppConfig(): InvestAppConfig {
    this.assertActive();
    return cloneAppConfig(this.appConfig as InvestAppConfig);
  }

  getDataClientConfig(): InvestDataClientConfig {
    this.assertActive();
    return cloneDataConfig(this.dataClientConfig as InvestDataClientConfig);
  }

  apiHooks(): ApiClientHooks {
    this.assertActive();
    return this.apiClientHooks;
  }

  getAdapters(): Readonly<InvestRuntimeAdapters> {
    this.assertActive();
    return this.runtimeAdapters;
  }

  configureAdapters(adapters: InvestRuntimeAdapters): void {
    this.assertActive();
    this.runtimeAdapters = Object.freeze({
      ...this.runtimeAdapters,
      ...adapters,
    });
  }

  createApiClient(key: InvestDataApiKey): ApiClient {
    this.assertActive();
    return this.createApiClientForBaseUrl(
      this.dataClientConfig.apiUrls?.[key] ?? "",
    );
  }

  createApiClientForBaseUrl(baseUrl: string): ApiClient {
    this.assertActive();
    return new ApiClient(baseUrl, {
      allowedRedirectOrigins: this.dataClientConfig.allowedRedirectOrigins,
      allowInsecureOrigins: this.allowInsecureSdkOrigins,
      hooks: () => this.apiHooks(),
      fetch: this.fetchImpl,
      signal: this.abortController.signal,
    });
  }

  createKeyedApiClient(key: InvestDataApiKey): ApiClient {
    this.assertActive();
    return this.createKeyedApiClientForBaseUrl(
      this.dataClientConfig.apiUrls?.[key] ?? "",
    );
  }

  createKeyedApiClientForBaseUrl(baseUrl: string): ApiClient {
    this.assertActive();
    if (!this.applicationKey?.trim()) {
      throw new InvestApplicationContextError(
        "No application key is configured for this invest application context.",
      );
    }
    return new ApiClient(baseUrl, {
      allowedRedirectOrigins: this.dataClientConfig.allowedRedirectOrigins,
      allowInsecureOrigins: this.allowInsecureSdkOrigins,
      hooks: () => this.apiHooks(),
      fetch: this.fetchImpl,
      signal: this.abortController.signal,
      applicationKey: this.applicationKey,
    });
  }

  private createRuntimeOfflineFetch(): typeof fetch {
    const context = this;
    const fetchImplementation = this.fetchImpl ?? globalThis.fetch;
    if (!fetchImplementation) {
      throw new InvestApplicationContextError(
        "A fetch implementation is required for SDK resources.",
      );
    }

    return async (input, init) => {
      context.assertActive();
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      const signal = requestSignal(input, init);
      const policy = context.apiClientHooks.matchOfflinePolicy(url, method);
      const reportPolicyError = async (
        phase: "read" | "read-metadata" | "persist",
        error: unknown,
      ) => {
        if (!policy || !context.apiClientHooks.reportOfflinePolicyError) return;
        try {
          await context.apiClientHooks.reportOfflinePolicyError({
            phase,
            error,
            policy,
            requestUrl: url,
          });
        } catch {
          // Offline diagnostics must not replace the transport result.
        }
      };

      let response: Response;
      try {
        response = await fetchImplementation(input, init);
      } catch (error) {
        throwIfRequestAborted(signal);
        if (policy?.persistToIndexedDb && method === "GET") {
          try {
            const cached = await context.apiClientHooks.readOfflineResponse(
              policy,
              url,
            );
            throwIfRequestAborted(signal);
            if (cached) {
              return responseFromOfflineData(
                cached.data,
                cached.status,
                new Headers(cached.headers),
                context.apiClientHooks,
                cached.lastSyncedAt,
              );
            }
          } catch (cacheError) {
            throwIfRequestAborted(signal);
            await reportPolicyError("read", cacheError);
          }
        }
        throw error;
      }

      if (!policy?.persistToIndexedDb || method !== "GET" || !response.ok) {
        return response;
      }

      if (!context.apiClientHooks.isOnline()) {
        let lastSyncedAt: string | null | undefined;
        try {
          const metadata =
            await context.apiClientHooks.readOfflineResponseMetadata(
              policy,
              url,
            );
          lastSyncedAt = metadata?.lastSyncedAt;
        } catch (error) {
          await reportPolicyError("read-metadata", error);
        }
        return withOfflineHeaders(
          response,
          context.apiClientHooks,
          "offline-cache",
          lastSyncedAt,
        );
      }

      if (response.status === 204 || response.status === 205) {
        return response;
      }

      return withOfflineHeaders(
        response,
        context.apiClientHooks,
        "network",
        null,
      );
    };
  }

  private async persistSdkRead<T>(
    baseUrl: string,
    input: RuntimeSdkRequestInput<T>,
    result: SdkResult<T>,
  ): Promise<SdkResult<T>> {
    if (
      this.disposed ||
      input.method !== "GET" ||
      result.status === 204 ||
      result.status === 205 ||
      result.metadata.source !== "network"
    ) {
      return result;
    }

    const url = resolveSdkRequestUrl(baseUrl, input.path, input.query);
    const policy = this.apiClientHooks.matchOfflinePolicy(url, input.method);
    if (!policy?.persistToIndexedDb) return result;

    const updatedAt = new Date().toISOString();
    try {
      await this.apiClientHooks.persistOfflineResponse(policy, url, {
        data: result.data,
        status: result.status,
        headers: result.headers,
        payloadType: sdkPersistedPayloadType(input, result),
        updatedAt,
      });
    } catch (error) {
      try {
        await this.apiClientHooks.reportOfflinePolicyError?.({
          phase: "persist",
          error,
          policy,
          requestUrl: url,
        });
      } catch {
        // Offline diagnostics must not replace a validated transport result.
      }
    }
    result.headers.set(this.apiClientHooks.offlineLastSyncHeader, updatedAt);
    return result;
  }

  private withRuntimeOfflinePersistence(
    baseUrl: string,
    client: SdkServiceClient,
  ): SdkServiceClient {
    const context = this;
    const executeInternal = async (
      input: RuntimeSdkRequestInput,
    ): Promise<SdkResult<unknown>> => {
      let result: SdkResult<unknown>;
      const { responseValidator, ...requestInput } = input;
      if (responseValidator === undefined) {
        const unvalidatedInput: SdkRequestInput = requestInput;
        result = await client.request(unvalidatedInput);
      } else {
        const validatedInput: SdkValidatedRequestInput<unknown> = {
          ...requestInput,
          responseValidator,
        };
        result = await client.request(validatedInput);
      }
      return context.persistSdkRead(baseUrl, input, result);
    };

    function requestWithPersistence<T>(
      input: SdkValidatedRequestInput<T>,
    ): Promise<SdkResult<T>>;
    function requestWithPersistence<
      Mode extends "text" | "blob" | "arrayBuffer",
    >(
      input: SdkRequestInput<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function requestWithPersistence(
      input: SdkRequestInput,
    ): Promise<SdkResult<unknown>>;
    function requestWithPersistence(
      input: RuntimeSdkRequestInput,
    ): Promise<SdkResult<unknown>> {
      return executeInternal(input);
    }

    function getWithPersistence<T>(
      path: string,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function getWithPersistence<Mode extends "text" | "blob" | "arrayBuffer">(
      path: string,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function getWithPersistence(
      path: string,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function getWithPersistence(
      path: string,
      options: RuntimeSdkConvenienceRequestOptions = {},
    ): Promise<SdkResult<unknown>> {
      return executeInternal({ ...options, method: "GET", path });
    }

    function headWithPersistence<T>(
      path: string,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function headWithPersistence<
      Mode extends "text" | "blob" | "arrayBuffer",
    >(
      path: string,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function headWithPersistence(
      path: string,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function headWithPersistence(
      path: string,
      options: RuntimeSdkConvenienceRequestOptions = {},
    ): Promise<SdkResult<unknown>> {
      return executeInternal({ ...options, method: "HEAD", path });
    }

    function optionsWithPersistence<T>(
      path: string,
      options: SdkValidatedOptionsRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function optionsWithPersistence<
      Mode extends "text" | "blob" | "arrayBuffer",
    >(
      path: string,
      options: SdkOptionsRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function optionsWithPersistence(
      path: string,
      options?: SdkOptionsRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function optionsWithPersistence(
      path: string,
      options: RuntimeSdkOptionsRequestOptions = {},
    ): Promise<SdkResult<unknown>> {
      const { schema = true, query, ...requestOptions } = options;
      const schemaQuery = schema ? { ...query, schema: 1 } : query;
      const input: RuntimeSdkRequestInput = {
        ...requestOptions,
        method: "OPTIONS",
        path,
      };
      if (schemaQuery !== undefined) input.query = schemaQuery;
      return executeInternal(input);
    }

    const withMethod = (
      method: SdkHttpMethod,
      path: string,
      body: unknown,
      options: RuntimeSdkConvenienceRequestOptions = {},
    ): Promise<SdkResult<unknown>> =>
      executeInternal({ ...options, method, path, body });

    function postWithPersistence<T>(
      path: string,
      body: unknown,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function postWithPersistence<Mode extends "text" | "blob" | "arrayBuffer">(
      path: string,
      body: unknown,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function postWithPersistence(
      path: string,
      body?: unknown,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function postWithPersistence(
      path: string,
      body?: unknown,
      options?: RuntimeSdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>> {
      return withMethod("POST", path, body, options);
    }

    function putWithPersistence<T>(
      path: string,
      body: unknown,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function putWithPersistence<Mode extends "text" | "blob" | "arrayBuffer">(
      path: string,
      body: unknown,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function putWithPersistence(
      path: string,
      body?: unknown,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function putWithPersistence(
      path: string,
      body?: unknown,
      options?: RuntimeSdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>> {
      return withMethod("PUT", path, body, options);
    }

    function patchWithPersistence<T>(
      path: string,
      body: unknown,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function patchWithPersistence<Mode extends "text" | "blob" | "arrayBuffer">(
      path: string,
      body: unknown,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function patchWithPersistence(
      path: string,
      body?: unknown,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function patchWithPersistence(
      path: string,
      body?: unknown,
      options?: RuntimeSdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>> {
      return withMethod("PATCH", path, body, options);
    }

    function deleteWithPersistence<T>(
      path: string,
      body: unknown,
      options: SdkValidatedConvenienceRequestOptions<T>,
    ): Promise<SdkResult<T>>;
    function deleteWithPersistence<
      Mode extends "text" | "blob" | "arrayBuffer",
    >(
      path: string,
      body: unknown,
      options: SdkConvenienceRequestOptions<Mode> & { responseMode: Mode },
    ): Promise<SdkResult<SdkResponseData<Mode>>>;
    function deleteWithPersistence(
      path: string,
      body?: unknown,
      options?: SdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>>;
    function deleteWithPersistence(
      path: string,
      body?: unknown,
      options?: RuntimeSdkConvenienceRequestOptions,
    ): Promise<SdkResult<unknown>> {
      return withMethod("DELETE", path, body, options);
    }

    return Object.freeze({
      request: requestWithPersistence,
      get: getWithPersistence,
      head: headWithPersistence,
      options: optionsWithPersistence,
      post: postWithPersistence,
      put: putWithPersistence,
      patch: patchWithPersistence,
      delete: deleteWithPersistence,
    });
  }

  createSdkServiceClient(
    key: InvestDataApiKey,
    options: InvestApplicationSdkServiceOptions,
  ): SdkServiceClient {
    this.assertActive();
    const baseUrl = this.dataClientConfig.apiUrls?.[key] ?? "";
    const functionId = (
      callback: ((...args: never[]) => unknown) | undefined,
    ): number | null => {
      if (!callback) return null;
      const existing = this.sdkFunctionIds.get(callback);
      if (existing) return existing;
      const assigned = this.nextSdkFunctionId;
      this.nextSdkFunctionId += 1;
      this.sdkFunctionIds.set(callback, assigned);
      return assigned;
    };
    const authKey =
      options.auth.kind === "bearer"
        ? {
            kind: options.auth.kind,
            credentials: options.auth.credentials,
            getToken: functionId(
              options.auth.getToken as (...args: never[]) => unknown,
            ),
            deduplicationScope: functionId(options.auth.deduplicationScope),
          }
        : options.auth.kind === "cookie"
          ? {
              kind: options.auth.kind,
              credentials: options.auth.credentials,
              deduplicationScope: functionId(options.auth.deduplicationScope),
            }
          : {
              kind: options.auth.kind,
              credentials: options.auth.credentials,
            };
    const clientKey = JSON.stringify({
      key,
      baseUrl,
      applicationAuth: options.applicationAuth,
      auth: authKey,
      headerPolicy: options.headerPolicy ?? "standard",
      redirectPolicy: options.redirectPolicy ?? "error",
      retry: options.retry,
      offlinePolicy: options.offlinePolicy ?? "none",
      timeoutMs: options.timeoutMs,
    });
    const existingClient = this.sdkServiceClients.get(clientKey);
    if (existingClient) return existingClient;

    const transport = createInvestSdkTransport({
      ...(options.applicationAuth === "api-key"
        ? { apiKey: this.applicationKey }
        : {}),
      fetch:
        options.offlinePolicy === "runtime"
          ? this.createRuntimeOfflineFetch()
          : this.fetchImpl,
      createRequestId: this.apiClientHooks.createRequestId,
      resolveResponseSource:
        options.offlinePolicy === "runtime"
          ? (response) =>
              response.headers.get(
                this.apiClientHooks.offlineResponseSourceHeader,
              ) === "offline-cache"
                ? "offline-cache"
                : "network"
          : undefined,
      allowInsecureOrigins: this.allowInsecureSdkOrigins,
      retry: options.retry,
      timeoutMs: options.timeoutMs,
      services: {
        [key]: {
          baseUrl,
          applicationAuth: options.applicationAuth,
          auth: options.auth,
          headerPolicy: options.headerPolicy,
          redirectPolicy: options.redirectPolicy,
        },
      },
    });
    this.sdkTransports.add(transport);
    const transportClient = transport.createServiceClient(key);
    const client =
      options.offlinePolicy === "runtime"
        ? this.withRuntimeOfflinePersistence(baseUrl, transportClient)
        : transportClient;
    this.sdkServiceClients.set(clientKey, client);
    return client;
  }

  createEvmSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): EvmResource {
    return createEvmResource(
      this.createSdkServiceClient("evm", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        retry: { maxRetries: 1, delayMs: 250 },
        offlinePolicy: "runtime",
        timeoutMs: null,
      }),
    );
  }

  createAnalyticsSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): AnalyticsResource {
    return createAnalyticsResource(
      this.createSdkServiceClient("analytic", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        timeoutMs: null,
      }),
    );
  }

  createEsignSdkResource(
    applicationAuth: NonNullable<
      SdkServiceConfig["applicationAuth"]
    > = "none",
  ): EsignResource {
    return createEsignResource(
      this.createSdkServiceClient("esign", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        timeoutMs: null,
      }),
    );
  }

  createNotificationsSdkResource(
    notificationsApplicationAuth: NonNullable<
      SdkServiceConfig["applicationAuth"]
    > = "none",
    usersApplicationAuth: NonNullable<
      SdkServiceConfig["applicationAuth"]
    > = "none",
  ): NotificationsResource {
    return createNotificationsResource({
      notifications: this.createSdkServiceClient("notification", {
        applicationAuth: notificationsApplicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        retry: { maxRetries: 1, delayMs: 250 },
        offlinePolicy: "runtime",
        timeoutMs: null,
      }),
      users: this.createSdkServiceClient("user", {
        applicationAuth: usersApplicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        timeoutMs: null,
      }),
    });
  }

  createOffersSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): OffersResource {
    return createOffersResource(
      this.createSdkServiceClient("offer", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        retry: { maxRetries: 1, delayMs: 250 },
        offlinePolicy: "runtime",
        timeoutMs: null,
      }),
    );
  }

  createInvestmentsSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): InvestmentsResource {
    return createInvestmentsResource(
      this.createSdkServiceClient("investment", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        retry: { maxRetries: 1, delayMs: 250 },
        offlinePolicy: "runtime",
        timeoutMs: null,
      }),
    );
  }

  createInvitationsSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): InvitationsResource {
    return createInvitationsResource(
      this.createSdkServiceClient("user", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        redirectPolicy: applicationAuth === "api-key" ? "error" : "follow",
        retry: { maxRetries: 1, delayMs: 250 },
        timeoutMs: null,
      }),
    );
  }

  createVaultSdkResource(
    applicationAuth: NonNullable<SdkServiceConfig["applicationAuth"]> = "none",
  ): VaultResource {
    return createVaultResource(
      this.createSdkServiceClient("investment", {
        applicationAuth,
        auth: cookieAuth({ credentials: "include" }),
        retry: { maxRetries: 1, delayMs: 250 },
        offlinePolicy: "runtime",
        timeoutMs: null,
      }),
    );
  }

  createRawClient(
    key: InvestDataApiKey,
  ): ReturnType<typeof createInvestDataClient> {
    this.assertActive();
    const context = this;
    const configuredHooks = this.rawClientHooks;

    return createInvestDataClient({
      baseUrl: this.dataClientConfig.apiUrls?.[key] ?? "",
      allowedRedirectOrigins: this.dataClientConfig.allowedRedirectOrigins,
      allowInsecureOrigins: this.allowInsecureSdkOrigins,
      fetch: this.fetchImpl,
      signal: this.abortController.signal,
      hooks: {
        getAuthHeaders: async () => {
          context.assertActive();
          return configuredHooks?.getAuthHeaders?.() ?? {};
        },
        onRequest: async (requestContext) => {
          context.assertActive();
          await configuredHooks?.onRequest?.(requestContext);
        },
        onResponse: async (requestContext) => {
          context.assertActive();
          await configuredHooks?.onResponse?.(requestContext);
        },
        onError: async (requestContext) => {
          context.assertActive();
          await configuredHooks?.onError?.(requestContext);
        },
      },
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sdkTransports.forEach((transport) => transport.dispose());
    this.sdkTransports.clear();
    this.sdkServiceClients.clear();
    this.abortController.abort(new InvestApplicationContextDisposedError());
    activeCompatibilityContexts.delete(this);
    this.onDispose?.();
  }
}

export const investApplicationContextKey = Symbol(
  "invest-application-context",
) as InjectionKey<InvestApplicationContext>;

const installedApplicationContexts = new WeakMap<
  App,
  InvestApplicationContext
>();

export const createInvestApplicationContext = (
  options: InvestApplicationContextOptions,
): InvestApplicationContext => new InvestApplicationContext(options);

export const installInvestApplicationContext = (
  app: App,
  context: InvestApplicationContext,
): InvestApplicationContext => {
  context.assertActive();
  const installedContext = installedApplicationContexts.get(app);
  if (installedContext) {
    if (installedContext !== context) {
      throw new InvestApplicationContextError(
        "A different invest application context is already installed for this Vue application.",
      );
    }
    return context;
  }

  installedApplicationContexts.set(app, context);
  app.provide(investApplicationContextKey, context);

  if (typeof window !== "undefined") {
    activeCompatibilityContexts.add(context);
  }

  app.onUnmount(() => context.dispose());
  return context;
};

export const provideInvestApplicationContext = (
  context: InvestApplicationContext,
): InvestApplicationContext => {
  context.assertActive();
  provide(investApplicationContextKey, context);
  return context;
};

export const useInvestApplicationContext = (): InvestApplicationContext => {
  const context = inject(investApplicationContextKey, null);
  if (!context) {
    throw new InvestApplicationContextError(
      "No invest application context is installed for the current Vue application.",
    );
  }
  context.assertActive();
  return context;
};

export const resolveInvestApplicationContextForCompatibility = (
  consumer: string,
  explicitContext?: InvestApplicationContext,
): InvestApplicationContext => {
  if (explicitContext) {
    explicitContext.assertActive();
    return explicitContext;
  }

  if (typeof window === "undefined") {
    throw new InvestApplicationContextError(
      `Compatibility context fallback is disabled during SSR (${consumer}).`,
    );
  }

  const contexts = [...activeCompatibilityContexts].filter(
    (context) => !context.isDisposed,
  );
  if (contexts.length === 0) {
    throw new InvestApplicationContextError(
      `No active browser application context is available for compatibility consumer "${consumer}".`,
    );
  }
  if (contexts.length > 1) {
    throw new InvestApplicationContextError(
      `Compatibility consumer "${consumer}" cannot choose between ${contexts.length} active application contexts.`,
    );
  }

  compatibilityFallbackConsumers.set(
    consumer,
    (compatibilityFallbackConsumers.get(consumer) ?? 0) + 1,
  );
  return contexts[0];
};

export const getInvestApplicationContextFallbackSnapshot =
  (): InvestApplicationContextFallbackSnapshot => ({
    activeContextCount: [...activeCompatibilityContexts].filter(
      (context) => !context.isDisposed,
    ).length,
    totalFallbackResolutions: [
      ...compatibilityFallbackConsumers.values(),
    ].reduce((total, count) => total + count, 0),
    consumers: Object.freeze(
      Object.fromEntries(compatibilityFallbackConsumers),
    ),
  });

export const resetInvestApplicationContextForTests = (): void => {
  activeCompatibilityContexts.clear();
  compatibilityFallbackConsumers.clear();
};
