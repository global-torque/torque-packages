/** Optional structured shape for handlers that need to branch (retry, analytics). */
export type NormalizedError = { message: string; code?: string; statusCode?: number };

export type RuntimeErrorReporter = (
  error: unknown,
  fallbackMessage: string,
  context?: unknown,
) => void;

export type RuntimeErrorUiPresentation =
  | 'toast'
  | 'rate-limit'
  | 'offline-action'
  | 'server-alert';

export type RuntimeErrorUiReporterPayload = {
  error: unknown;
  fallbackMessage: string;
  normalized: NormalizedError;
  context?: unknown;
  presentation: RuntimeErrorUiPresentation;
  title: string;
  description: string;
};

export type RuntimeErrorUiReporter = (
  payload: RuntimeErrorUiReporterPayload,
) => void;

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (!error || typeof error !== 'object') return fallback;
  const o = error as Record<string, unknown>;
  if (typeof o.message === 'string') return o.message;
  const data = o.data as { responseJson?: Record<string, unknown> } | undefined;
  const msg = data?.responseJson?.__error__ ?? data?.responseJson?.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string') return msg;
  return fallback;
}

/**
 * Normalize error to a small shape (message, code, statusCode).
 * Reads statusCode from error.data.statusCode (APIError) or error.data.status.
 */
export function normalizeError(error: unknown, fallbackMessage: string): NormalizedError {
  const message = normalizeErrorMessage(error, fallbackMessage);
  if (!error || typeof error !== 'object') return { message };
  const data = (
    error as {
      data?: {
        responseJson?: { __error__?: string };
        status?: number;
        statusCode?: number;
      };
      status?: number;
      statusCode?: number;
    }
  ).data;
  let statusCode: number | undefined;
  if (typeof data?.statusCode === 'number') {
    statusCode = data.statusCode;
  } else if (typeof data?.status === 'number') {
    statusCode = data.status;
  } else if (typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    statusCode = (error as { statusCode: number }).statusCode;
  } else if (typeof (error as { status?: unknown }).status === 'number') {
    statusCode = (error as { status: number }).status;
  }
  return {
    message,
    code: typeof data?.responseJson?.__error__ === 'string' ? data.responseJson.__error__ : undefined,
    statusCode,
  };
}

/** Reporter used by reportError. Null = use defaultErrorReporter. */
let errorReporter: RuntimeErrorReporter | null = null;
let errorUiReporter: RuntimeErrorUiReporter | null = null;

/**
 * Replace the error reporter (e.g. in tests or for log-then-show).
 * Call with no args or null to reset to default (defaultErrorReporter).
 */
export function setErrorReporter(fn?: RuntimeErrorReporter | null) {
  errorReporter = fn ?? null;
}

export function getErrorReporter(): RuntimeErrorReporter | null {
  return errorReporter;
}

/**
 * Replace only the user-facing presentation layer. Analytics, status-code
 * branching, and global handler setup remain owned by the default reporter.
 */
export function setErrorUiReporter(fn?: RuntimeErrorUiReporter | null) {
  errorUiReporter = fn ?? null;
}

export function getErrorUiReporter(): RuntimeErrorUiReporter | null {
  return errorUiReporter;
}
