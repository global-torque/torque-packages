import {
  reportError,
  setErrorHandlers,
  setErrorLogger,
  setErrorUiReporter,
  type NormalizedError,
  type RuntimeErrorUiReporter,
} from './errorReporting.ts';
import { isIgnorableError } from './ignorableErrors.ts';
import {
  sendReportedErrorToAnalytics,
  type SendReportedErrorOptions,
} from '../analytics/sendReportedErrorToAnalytics.ts';
import { resolveComponentName } from '../analytics/analyticsVmComponent.ts';
import {
  getInvestRuntimeLinks,
  setInvestRuntimeClientServiceName,
} from '../config.ts';

declare global {
  interface Window {
    __VITEPRESS__?: {
      error?: (error: Error) => void;
      router?: { onError?: (error: Error) => void };
      pageTransition?: (...args: unknown[]) => Promise<unknown>;
    };
  }
}

type VueApp = { config?: { errorHandler?: (err: Error, vm: unknown, info: string) => void } };
type ErrorContext = SendReportedErrorOptions & {
  source?: SendReportedErrorOptions['source'];
  silent?: boolean;
};

export interface ErrorHandlerConfig {
  appType: 'vue' | 'vitepress';
}

let globalHandlersInstalled = false;
let vitePressHandlersInstalled = false;
let vitePressVueHandlerInstalled = false;
let vueHandlerApps = new WeakSet<object>();
let handledErrors = new WeakSet<object>();
const handledPrimitiveFingerprints = new Map<string, number>();
const PRIMITIVE_DEDUPE_WINDOW_MS = 1000;

const getContextObject = (context?: unknown): Record<string, unknown> => (
  context && typeof context === 'object' ? context as Record<string, unknown> : {}
);

const createAnalyticsLogger = (
  baseOptions: Pick<SendReportedErrorOptions, 'serviceName' | 'build'>,
) => (
  normalized: NormalizedError,
  fallbackMessage: string,
  context?: SendReportedErrorOptions,
) => {
  sendReportedErrorToAnalytics(normalized, fallbackMessage, {
    ...getContextObject(context),
    serviceName: baseOptions.serviceName,
    build: baseOptions.build,
  });
};

/** Coerce unknown (e.g. unhandledrejection.reason) to Error for global handlers. */
function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : fallback);
}

function getReasonType(value: unknown): string {
  if (value instanceof Error) return value.name || 'Error';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function getReasonMessage(value: unknown): string | undefined {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

function getElementResourceUrl(target: EventTarget | null): string | undefined {
  if (!target || typeof window === 'undefined' || !(target instanceof window.HTMLElement)) {
    return undefined;
  }

  const element = target as HTMLElement & {
    src?: string;
    href?: string;
    currentSrc?: string;
  };

  return element.currentSrc || element.src || element.href || undefined;
}

function getElementTagName(target: EventTarget | null): string | undefined {
  if (!target || typeof window === 'undefined' || !(target instanceof window.HTMLElement)) {
    return undefined;
  }

  return target.tagName;
}

function isOpaqueScriptError(event: ErrorEvent): boolean {
  const message = event.message || '';
  return message === 'Script error.'
    && !event.error
    && !event.filename
    && !event.lineno
    && !event.colno;
}

function shouldSkipDuplicate(error: Error, context: ErrorContext): boolean {
  const now = Date.now();
  const fingerprint = `${context.source ?? 'global'}|${error.name}|${error.message}`;
  const lastSeenAt = handledPrimitiveFingerprints.get(fingerprint);
  handledPrimitiveFingerprints.set(fingerprint, now);

  if (typeof error === 'object' && error !== null) {
    if (handledErrors.has(error)) return true;
    handledErrors.add(error);
  }

  if (lastSeenAt && now - lastSeenAt <= PRIMITIVE_DEDUPE_WINDOW_MS) {
    return true;
  }

  return false;
}

export function resetUnifiedErrorHandlerForTests(): void {
  globalHandlersInstalled = false;
  vitePressHandlersInstalled = false;
  vitePressVueHandlerInstalled = false;
  vueHandlerApps = new WeakSet<object>();
  handledErrors = new WeakSet<object>();
  handledPrimitiveFingerprints.clear();
}

export const setupUnifiedErrorHandler = () => {
  if (typeof window === 'undefined') return;

  const isFatal = (e: Error) => (e as { isFatal?: boolean }).isFatal === true;

  const handleError = (error: Error, context: ErrorContext = { source: 'global', silent: true }) => {
    if (isIgnorableError(error)) return;
    if (shouldSkipDuplicate(error, context)) return;
    // Global/unhandled errors: log to analytics but do not show a user-facing toast.
    reportError(error, 'Something went wrong', { source: 'global', silent: true, ...context });
    if (isFatal(error) && !window.location.pathname.endsWith('/500')) {
      setTimeout(() => window.location.replace(getInvestRuntimeLinks().serverError), 500);
    }
  };

  const setupGlobalHandlers = () => {
    if (globalHandlersInstalled) return;

    window.addEventListener('unhandledrejection', (e) => {
      const reason = (e as PromiseRejectionEvent).reason;
      handleError(toError(reason, 'Unhandled Promise Rejection'), {
        source: 'global',
        silent: true,
        promiseRejection: {
          reasonType: getReasonType(reason),
          reasonMessage: getReasonMessage(reason),
        },
      });
    });
    window.addEventListener('error', (e) => {
      const target = (e as Event).target as unknown;
      if (target && typeof window !== 'undefined' && target instanceof window.HTMLImageElement) {
        // Swallow image load errors completely: they are noisy and not actionable.
        if (typeof (e as Event).preventDefault === 'function') {
          (e as Event).preventDefault();
        }
        return;
      }
      const errorEvent = e as ErrorEvent;
      if (isOpaqueScriptError(errorEvent)) {
        return;
      }

      handleError(toError(errorEvent.error ?? errorEvent.message, 'Unknown error'), {
        source: 'global',
        silent: true,
        errorEvent: {
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno,
          message: errorEvent.message,
          tagName: getElementTagName(errorEvent.target),
          resourceUrl: getElementResourceUrl(errorEvent.target),
          opaqueScriptError: false,
        },
      });
    });

    globalHandlersInstalled = true;
  };

  const setupVueHandler = (app?: VueApp) => {
    if (!app?.config) return;
    if (vueHandlerApps.has(app as object)) return;
    const originalErrorHandler = app.config.errorHandler;
    app.config.errorHandler = (err, vm, info) => {
      handleError(err, {
        source: 'vue',
        silent: true,
        component: resolveComponentName(vm, 'VueErrorHandler'),
        caller: ['vue-error-handler', info].filter(Boolean),
      });
      originalErrorHandler?.(err, vm, info);
    };
    vueHandlerApps.add(app as object);
  };

  const setupVitePressHandler = () => {
    if (!window.__VITEPRESS__) return;

    if (!vitePressHandlersInstalled) {
      if (window.__VITEPRESS__.error) {
        const orig = window.__VITEPRESS__.error;
        window.__VITEPRESS__.error = (error) => {
          handleError(error, {
            source: 'vitepress',
            silent: true,
            caller: ['vitepress-error'],
          });
          orig(error);
        };
      }

      if (window.__VITEPRESS__.router?.onError) {
        const orig = window.__VITEPRESS__.router.onError;
        window.__VITEPRESS__.router.onError = (error) => {
          handleError(error, {
            source: 'vitepress',
            silent: true,
            caller: ['vitepress-router-on-error'],
          });
          orig(error);
        };
      }

      if (window.__VITEPRESS__.pageTransition) {
        const orig = window.__VITEPRESS__.pageTransition;
        window.__VITEPRESS__.pageTransition = async (...args: unknown[]) => {
          try {
            return await orig(...args);
          } catch (error) {
            if (error instanceof Error) {
              handleError(error, {
                source: 'vitepress',
                silent: true,
                caller: ['vitepress-page-transition'],
              });
            }
            throw error;
          }
        };
      }

      vitePressHandlersInstalled = true;
    }

    const Vue = (window as unknown as { Vue?: { config?: { errorHandler?: (err: Error, vm: unknown) => void } } }).Vue;
    if (Vue?.config && !vitePressVueHandlerInstalled) {
      const orig = Vue.config.errorHandler;
      Vue.config.errorHandler = (error, vm) => {
        handleError(error, {
          source: 'vue',
          silent: true,
          component: resolveComponentName(vm, 'VueErrorHandler'),
          caller: ['vue-error-handler'],
        });
        orig?.(error, vm);
      };
      vitePressVueHandlerInstalled = true;
    }
  };

  const initialize = (app?: VueApp) => {
    setupGlobalHandlers();
    setupVitePressHandler();
    setupVueHandler(app);
  };

  return { initialize };
};

export const setupVueErrorHandler = (app?: unknown) => {
  setupUnifiedErrorHandler()?.initialize(app as VueApp);
};

export const setupVitePressErrorHandler = () => {
  setupUnifiedErrorHandler()?.initialize();
};

// ---------------------------------------------------------------------------
// Single bootstrap: use this in main.ts / VitePress entry (by the book)
// ---------------------------------------------------------------------------

export type ErrorHandlingAppType = 'vue' | 'vitepress';

export interface SetupErrorHandlingOptions {
  /** Vue app instance (for type 'vue'); omit for VitePress. */
  app?: unknown;
  /** 'vue' = Vue app + global handlers; 'vitepress' = VitePress + global handlers. */
  type: ErrorHandlingAppType;
  /** App-owned 401 navigation callback. Omit when the host does not redirect. */
  onUnauthorized?: () => void;
  /** App-specific frontend service name used in analytics labels and fields. */
  serviceName: string;
  /** App-specific UI presenter. It does not replace analytics logging. */
  uiReporter?: RuntimeErrorUiReporter | null;
  /** Build context forwarded to analytics serviceContext. */
  build?: {
    version?: string;
    timestamp?: string;
  };
}

/**
 * Single bootstrap for error handling. Call once at app entry.
 *
 * What we log (send to analytics + toast):
 * - Caught errors: any code that calls reportError() → default reporter → setErrorLogger (analytics) → toast (unless 401).
 * - Uncaught errors: unhandledrejection, window.error, Vue/VitePress errorHandler → reportError() → same path.
 *
 * What we do not log (ignorable, no toast, no analytics):
 * - ResizeObserver loop/limit errors (browser quirk, no user impact).
 * - AbortError / canceled (user or code aborted request).
 * - Chunk load failures (handled separately by chunkErrorHandler; avoids duplicate noise).
 *
 * How we log:
 * - setErrorLogger(sendReportedErrorToAnalytics): sends to analytics when VITE_ENABLE_ANALYTICS=1, skips bots.
 * - Fatal errors (error.isFatal === true) also redirect to 500.
 *
   * Works for both Vue app and VitePress.
 */
export function setupErrorHandling(options: SetupErrorHandlingOptions): void {
  if (typeof window === 'undefined') return;

  const { app, type, onUnauthorized, serviceName, uiReporter, build } = options;
  setInvestRuntimeClientServiceName(serviceName);
  setErrorHandlers(onUnauthorized ? { onUnauthorized } : {});
  setErrorUiReporter(uiReporter ?? null);
  setErrorLogger(createAnalyticsLogger({ serviceName, build }));
  setupUnifiedErrorHandler()?.initialize(app as VueApp);
}
