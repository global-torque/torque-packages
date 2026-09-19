import type { NormalizedError } from '../error/errorReporting.ts';
import {
  AnalyticsLogLevel,
  type IAnalyticsClientErrorContext,
  type IAnalyticsErrorEventContext,
  type IAnalyticsHttpErrorContext,
  type IAnalyticsPromiseRejectionContext,
  type IAnalyticsRouteContext,
  type IAnalyticsMessage,
} from '@global-torque/domain-types/analyticsTypes';
import {
  normalizeAnalyticsBodyForMethod,
  sanitizeAnalyticsUrl,
  sanitizeAnalyticsText,
} from '@global-torque/invest-core/analytics/analyticsBody';
import { createClientErrorPipeline } from '@global-torque/client-error-handling/pipeline';
import type {
  ClientErrorReporter,
  NormalizedClientError,
  SerializableValue,
} from '@global-torque/client-error-handling/types';
import {
  getInvestRuntimeClientServiceName,
  getInvestRuntimeConfig,
  isInvestRuntimeFlagEnabled,
} from '../config.ts';
import { getInvestRuntimeAdapters } from '../adapters.ts';
import {
  buildHttpRequest,
  getClientContext,
  normalizeGroupMessage,
  resolveComponentNameFromStack,
} from './useAnalyticsError.ts';
import type { HttpRequestLike } from './useAnalyticsError.ts';
import { isIgnorableErrorMessage } from '../error/ignorableErrors.ts';
import { createRuntimeTransportSafeError } from '../error/transportSafeError.ts';

/**
 * Optional structured context passed by the caller.
 * All fields are selectively sanitized before being sent to analytics. Known
 * credential fields are removed while business and diagnostic context remains.
 */
export interface AnalyticsErrorContext {
  source?: IAnalyticsClientErrorContext['source'];
  component?: string;
  caller?: unknown[];
  stack?: string[];
  route?: IAnalyticsRouteContext;
  http?: IAnalyticsHttpErrorContext;
  errorEvent?: IAnalyticsErrorEventContext;
  promiseRejection?: IAnalyticsPromiseRejectionContext;
  /**
   * Optional HTTP request data, typically from APIError.data.httpRequest.
   * When provided, it is merged via buildHttpRequest to ensure consistent shape.
   */
  httpRequest?: Partial<HttpRequestLike>;
  body?: unknown;
  build?: {
    version?: string;
    timestamp?: string;
  };
  runtime?: IAnalyticsClientErrorContext['runtime'];
}

/**
 * Allows each app (Vue, Vitepress, etc.) to provide its own analytics service name
 * without duplicating the error reporting logic.
 */
export interface SendReportedErrorOptions extends AnalyticsErrorContext {
  serviceName?: string;
}

const DISPATCH_METADATA_KEY = 'dispatchId';
const MAX_PENDING_ANALYTICS_REPORTS = 50;
const CLIENT_ERROR_SOURCES = new Set<
  NonNullable<IAnalyticsClientErrorContext['source']>
>(['caught', 'global', 'vue', 'vitepress', 'api', 'chunk', 'manual']);
const HTTP_RESPONSE_SOURCES = new Set<
  NonNullable<IAnalyticsHttpErrorContext['responseSource']>
>(['http', 'network', 'offline-cache', 'cache', 'unknown']);
const HTTP_METHODS = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
]);

interface PendingAnalyticsDispatch {
  readonly analytics: NonNullable<ReturnType<typeof getInvestRuntimeAdapters>['analytics']>;
  readonly payload: IAnalyticsMessage;
}

const pendingAnalyticsDispatches = new Map<string, PendingAnalyticsDispatch>();
let nextDispatchId = 0;

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /AhrefsBot/i,
  /googlebot/i,
  /bingbot/i,
];

function shouldReportToAnalytics(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !BOT_PATTERNS.some((p) => p.test(navigator.userAgent));
}

function sanitizeText(raw: unknown): string {
  return sanitizeAnalyticsText(raw);
}

function sanitizeOptionalText(raw: unknown): string | undefined {
  const sanitized = sanitizeText(raw).trim();
  return sanitized || undefined;
}

function allowlistedString<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T | undefined {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function sanitizeComponent(component?: string): string {
  const fallback = 'reportError';
  if (!component) return fallback;
  const sanitized = sanitizeText(component).trim();
  return sanitized || fallback;
}

function sanitizeCaller(
  caller?: unknown[],
  fallbackMessage?: string,
  normalized?: NormalizedError,
  component?: string,
): string[] {
  const baseCaller = [
    component || 'reportError',
    fallbackMessage,
    normalized?.code ?? '',
    String(normalized?.statusCode ?? ''),
  ]
    .filter((v) => v != null && v !== '') as string[];

  if (!caller || caller.length === 0) {
    return baseCaller.map((c) => sanitizeText(c));
  }

  const userProvided = caller
    .map((item) => sanitizeText(item))
    .filter((item) => item !== '');

  const combined = userProvided.length > 0 ? userProvided : baseCaller;

  // Limit depth to avoid very long arrays.
  return combined.slice(0, 10);
}

function sanitizeStack(stack?: string[]): string[] {
  if (!stack || stack.length === 0) return [];

  // Only keep the top part of the stack and sanitize each line.
  return stack
    .slice(0, 15)
    .map((line) => sanitizeText(line))
    .filter((line) => line !== '');
}

function sanitizeUrlText(raw: unknown): string | undefined {
  const value = typeof raw === 'string' ? sanitizeAnalyticsUrl(raw) : '';
  if (!value) return undefined;
  return sanitizeAnalyticsText(value);
}

function sanitizePathText(raw: unknown): string | undefined {
  const value = typeof raw === 'string' ? sanitizeAnalyticsUrl(raw) : '';
  if (!value) return undefined;
  return sanitizeAnalyticsText(value);
}

function buildTransportHttpRequest(httpRequest: HttpRequestLike): HttpRequestLike {
  const protocol = httpRequest.protocol === 'http:' || httpRequest.protocol === 'https:'
    ? httpRequest.protocol
    : '';
  return {
    method: sanitizeOptionalText(httpRequest.method) ?? 'GET',
    url: sanitizeUrlText(httpRequest.url) ?? '',
    path: sanitizePathText(httpRequest.path) ?? '',
    userAgent: sanitizeOptionalText(httpRequest.userAgent) ?? '',
    referer: sanitizeOptionalText(httpRequest.referer) ?? '',
    remoteIp: sanitizeOptionalText(httpRequest.remoteIp) ?? '',
    protocol,
  };
}

function buildTransportClientContext(): ReturnType<typeof getClientContext> {
  const client = getClientContext();
  const width = client.viewport?.width;
  const height = client.viewport?.height;
  return {
    userAgent: sanitizeOptionalText(client.userAgent),
    language: sanitizeOptionalText(client.language),
    timeZone: sanitizeOptionalText(client.timeZone),
    onLine: typeof client.onLine === 'boolean' ? client.onLine : undefined,
    viewport: {
      width: typeof width === 'number' && Number.isFinite(width) ? width : undefined,
      height: typeof height === 'number' && Number.isFinite(height) ? height : undefined,
    },
    screen: client.screen
      ? Object.fromEntries(
        Object.entries(client.screen).map(([key, value]) => [
          key,
          typeof value === 'number' && Number.isFinite(value) ? value : undefined,
        ]),
      )
      : undefined,
    orientation: client.orientation
      ? {
        type: sanitizeOptionalText(client.orientation.type),
        angle: typeof client.orientation.angle === 'number' && Number.isFinite(client.orientation.angle)
          ? client.orientation.angle
          : undefined,
      }
      : undefined,
  };
}

function getCurrentRouteContext(): IAnalyticsRouteContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return {
    path: sanitizePathText(`${window.location.pathname}${window.location.search}${window.location.hash}`),
  };
}

function sanitizeRouteContext(route?: IAnalyticsRouteContext): IAnalyticsRouteContext | undefined {
  const nextRoute = route ?? getCurrentRouteContext();
  if (!nextRoute) return undefined;

  const path = sanitizePathText(nextRoute.path);
  const name = sanitizeOptionalText(nextRoute.name);
  if (!path && !name) return undefined;

  return { path, name };
}

function sanitizeErrorEventContext(
  errorEvent?: IAnalyticsErrorEventContext,
): IAnalyticsErrorEventContext | undefined {
  if (!errorEvent) return undefined;

  const nextErrorEvent: IAnalyticsErrorEventContext = {
    filename: sanitizeUrlText(errorEvent.filename),
    lineno: finiteNumber(errorEvent.lineno),
    colno: finiteNumber(errorEvent.colno),
    message: sanitizeOptionalText(errorEvent.message),
    tagName: sanitizeOptionalText(errorEvent.tagName),
    resourceUrl: sanitizeUrlText(errorEvent.resourceUrl),
    opaqueScriptError: errorEvent.opaqueScriptError === true,
  };

  return Object.fromEntries(
    Object.entries(nextErrorEvent).filter(([, value]) => value !== undefined && value !== ''),
  ) as IAnalyticsErrorEventContext;
}

function sanitizePromiseRejectionContext(
  promiseRejection?: IAnalyticsPromiseRejectionContext,
): IAnalyticsPromiseRejectionContext | undefined {
  if (!promiseRejection) return undefined;

  const nextRejection: IAnalyticsPromiseRejectionContext = {
    reasonType: sanitizeOptionalText(promiseRejection.reasonType),
    reasonMessage: sanitizeOptionalText(promiseRejection.reasonMessage),
  };

  return Object.fromEntries(
    Object.entries(nextRejection).filter(([, value]) => value !== undefined && value !== ''),
  ) as IAnalyticsPromiseRejectionContext;
}

function buildHttpContext(
  normalized: NormalizedError,
  httpRequest: HttpRequestLike,
  options: SendReportedErrorOptions,
): IAnalyticsHttpErrorContext {
  const status = finiteNumber(options.http?.status);
  const statusCode =
    finiteNumber(options.http?.statusCode) ??
    status ??
    finiteNumber(normalized.statusCode);
  const responseSource =
    allowlistedString(options.http?.responseSource, HTTP_RESPONSE_SOURCES) ??
    (statusCode === 0
      ? 'network'
      : statusCode !== undefined
        ? 'http'
        : 'unknown');
  const rawMethod = options.http?.method ?? httpRequest.method;
  const method = allowlistedString(
    typeof rawMethod === 'string' ? rawMethod.toUpperCase() : undefined,
    HTTP_METHODS,
  );

  return {
    method: method ?? 'GET',
    url: sanitizeUrlText(options.http?.url ?? httpRequest.url),
    path: sanitizePathText(options.http?.path ?? httpRequest.path),
    status,
    statusCode,
    responseSource,
    offline:
      booleanValue(options.http?.offline) ??
      (typeof navigator !== 'undefined'
        ? booleanValue(navigator.onLine === false)
        : undefined),
  };
}

function buildClientErrorContext(
  normalized: NormalizedError,
  httpRequest: HttpRequestLike,
  options: SendReportedErrorOptions,
): IAnalyticsClientErrorContext {
  const runtimeConfig = getInvestRuntimeConfig();
  const runtimeContext = {
    frontendEnv: sanitizeOptionalText(options.runtime?.frontendEnv ?? runtimeConfig.env),
    isStaticSite:
      booleanValue(options.runtime?.isStaticSite) ??
      booleanValue(runtimeConfig.isStaticSite),
    isDev:
      booleanValue(options.runtime?.isDev) ?? booleanValue(runtimeConfig.isDev),
    buildVersion: sanitizeOptionalText(options.runtime?.buildVersion ?? options.build?.version ?? runtimeConfig.build?.version),
    buildTimestamp: sanitizeOptionalText(options.runtime?.buildTimestamp ?? options.build?.timestamp ?? runtimeConfig.build?.timestamp),
  };

  const context: IAnalyticsClientErrorContext = {
    source:
      allowlistedString(options.source, CLIENT_ERROR_SOURCES) ??
      (options.httpRequest ? 'api' : 'caught'),
    route: sanitizeRouteContext(options.route),
    http: buildHttpContext(normalized, httpRequest, options),
    errorEvent: sanitizeErrorEventContext(options.errorEvent),
    promiseRejection: sanitizePromiseRejectionContext(options.promiseRejection),
    runtime: runtimeContext,
  };

  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as IAnalyticsClientErrorContext;
}

function createFingerprint(
  transportFingerprint: string,
  serviceName: string,
  component: string,
  context: IAnalyticsClientErrorContext,
): string {
  return [
    transportFingerprint,
    serviceName,
    context.source ?? 'caught',
    component,
    context.route?.path ?? '',
    context.http?.statusCode ?? '',
  ].join('|');
}

function opaqueRuntimeName(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }
  return `RuntimeClientError_${hash.toString(16).padStart(8, '0')}`;
}

function isSerializableRecord(
  value: SerializableValue | undefined,
): value is { readonly [key: string]: SerializableValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function metadataDispatchId(context: SerializableValue | undefined): string | undefined {
  if (!isSerializableRecord(context)) return undefined;
  const metadata = context.metadata;
  if (!isSerializableRecord(metadata)) return undefined;
  const dispatchId = metadata[DISPATCH_METADATA_KEY];
  return typeof dispatchId === 'string' ? dispatchId : undefined;
}

const analyticsReporter: ClientErrorReporter = Object.freeze({
  async report(error: NormalizedClientError): Promise<void> {
    const dispatchId = metadataDispatchId(error.context);
    if (!dispatchId) return;
    const dispatch = pendingAnalyticsDispatches.get(dispatchId);
    if (!dispatch) return;
    await dispatch.analytics.logMessage({
      ...dispatch.payload,
      time: error.timestamp,
    });
  },
});

const reportedErrorPipeline = createClientErrorPipeline({
  reporters: [analyticsReporter],
  dedupe: { ttlMs: 30_000, maxEntries: 250 },
  rateLimit: { maxReports: 20, intervalMs: 60_000 },
  maxQueueSize: MAX_PENDING_ANALYTICS_REPORTS,
  normalize: {
    sanitize: {
      allowedMetadataKeys: [DISPATCH_METADATA_KEY],
      maxStringLength: 500,
      maxTotalBytes: 8_192,
    },
    maxStackFrames: 15,
  },
});

export function resetReportedErrorAnalyticsDedupeForTests(): void {
  reportedErrorPipeline.clear();
  pendingAnalyticsDispatches.clear();
  nextDispatchId = 0;
}

/**
 * Sends a reported error (from reportError) to the analytics log.
 * Use as setErrorLogger at app bootstrap so every user-facing error is recorded.
 * Respects VITE_ENABLE_ANALYTICS=1; skips when analytics disabled or user agent is a bot.
 *
 * The caller can optionally provide component/caller/stack via options; these are selectively
 * sanitized and merged with sensible defaults before sending to analytics.
 */
export function sendReportedErrorToAnalytics(
  normalized: NormalizedError,
  fallbackMessage: string,
  options: SendReportedErrorOptions = {},
): void {
  if (!isInvestRuntimeFlagEnabled('ENABLE_ANALYTICS') || !shouldReportToAnalytics()) return;

  const combinedMessage = `${fallbackMessage ?? ''} ${normalized.message ?? ''}`;
  if (isIgnorableErrorMessage(combinedMessage)) return;
  if (options.errorEvent?.opaqueScriptError === true) return;

  try {
    const analytics = getInvestRuntimeAdapters().analytics;

    if (!analytics) {
      return;
    }

    const httpRequest = buildTransportHttpRequest(
      buildHttpRequest(options.httpRequest),
    );
    const body = normalizeAnalyticsBodyForMethod(httpRequest.method, options.body);
    const safeFallbackMessage = sanitizeText(fallbackMessage);
    const safeNormalizedMessage = sanitizeText(normalized.message);
    const finalErrorText = [safeFallbackMessage, safeNormalizedMessage]
      .filter((value) => value.trim() !== '')
      .join(': ');
    const initialStack = sanitizeStack(options.stack);
    const stackString = initialStack.join('\n');

    const inferredComponent =
      options.component
      ?? (stackString ? resolveComponentNameFromStack(stackString) : undefined);

    const component = sanitizeComponent(inferredComponent);
    const caller = sanitizeCaller(options.caller, fallbackMessage, normalized, component);
    const runtimeConfig = getInvestRuntimeConfig();
    const serviceName = sanitizeOptionalText(options.serviceName)
      ?? sanitizeOptionalText(getInvestRuntimeClientServiceName());

    if (!serviceName) {
      return;
    }
    const buildVersion = sanitizeOptionalText(options.build?.version ?? runtimeConfig.build?.version);
    const buildTimestamp = sanitizeOptionalText(options.build?.timestamp ?? runtimeConfig.build?.timestamp);
    const frontendEnv = sanitizeOptionalText(runtimeConfig.env);
    const clientErrorContext = buildClientErrorContext(normalized, httpRequest, options);
    const transportError = createRuntimeTransportSafeError(
      {
        ...normalized,
        message: safeNormalizedMessage,
      },
      safeFallbackMessage,
      {
        source: clientErrorContext.source,
        component,
        route: clientErrorContext.route?.path,
        request: {
          method: httpRequest.method,
          url: httpRequest.url,
        },
        stack: initialStack,
        filename: clientErrorContext.errorEvent?.filename,
        lineno: clientErrorContext.errorEvent?.lineno,
        colno: clientErrorContext.errorEvent?.colno,
        unhandledRejection: clientErrorContext.promiseRejection !== undefined,
      },
    );
    const fingerprint = createFingerprint(
      transportError.fingerprint,
      serviceName,
      component,
      clientErrorContext,
    );

    if (pendingAnalyticsDispatches.size >= MAX_PENDING_ANALYTICS_REPORTS) {
      return;
    }

    nextDispatchId += 1;
    const dispatchId = `analytics-${String(nextDispatchId)}`;
    pendingAnalyticsDispatches.set(dispatchId, {
      analytics,
      payload: {
        time: '',
        level: AnalyticsLogLevel.ERROR,
        message: normalizeGroupMessage(safeNormalizedMessage),
        error: finalErrorText,
        body,
        data: {
          component,
          caller,
          stack: initialStack,
          serviceContext: {
            httpRequest,
            service_name: serviceName,
            version: buildVersion,
            build_timestamp: buildTimestamp,
            event_source: 'client',
            frontend_env: frontendEnv,
          },
          client: buildTransportClientContext(),
          context: clientErrorContext,
        },
      },
    });
    void reportedErrorPipeline
      .report(
        {
          name: opaqueRuntimeName(fingerprint),
          message: transportError.message,
          stack: transportError.stack,
        },
        { metadata: { [DISPATCH_METADATA_KEY]: dispatchId } },
      )
      .finally(() => {
        pendingAnalyticsDispatches.delete(dispatchId);
      });
  } catch {
    // Composable or env not available (e.g. SSR); ignore
  }
}
