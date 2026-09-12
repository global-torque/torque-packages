import { SdkHttpError } from '@global-torque/sdk';
import type { APIErrorData } from '../service/handlers/apiError.ts';

const SECRET_PATH_LABEL = /^(?:api[-_]?key|authorization|bearer|cookie|csrf(?:_token)?|password|secret|token)$/iu;
const JWT_LIKE_SEGMENT = /^[A-Za-z\d_-]{8,}\.[A-Za-z\d_-]{8,}\.[A-Za-z\d_-]{8,}$/u;
const SAFE_REQUEST_HEADERS = new Set(['accept', 'content-type', 'x-request-id']);

const sanitizePathname = (pathname: string): string => {
  const segments = pathname.split('/');
  return segments.map((segment, index) => {
    const previous = segments[index - 1] ?? '';
    if (
      SECRET_PATH_LABEL.test(previous)
      || JWT_LIKE_SEGMENT.test(segment)
      || segment.length > 256
    ) {
      return '[redacted]';
    }
    return segment;
  }).join('/');
};

export const sanitizeCompatibilityUrl = (value: string): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${sanitizePathname(url.pathname)}`;
  }
  catch {
    return value.replace(/[?#].*$/u, '').slice(0, 500);
  }
};

export const createCompatibilityHttpRequest = (
  method: string,
  requestUrl: string,
): APIErrorData['httpRequest'] => {
  const sanitizedUrl = sanitizeCompatibilityUrl(requestUrl);
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(sanitizedUrl);
  }
  catch {
    parsedUrl = null;
  }

  return {
    method,
    url: sanitizedUrl,
    path: parsedUrl?.pathname ?? '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    referer: typeof document !== 'undefined'
      ? sanitizeCompatibilityUrl(document.referrer)
      : '',
    remoteIp: '',
    protocol: parsedUrl?.protocol.replace(':', '') ?? '',
  };
};

export const createCompatibilityDiagnosticHeaders = (headers?: HeadersInit): Headers => {
  const sanitized = new Headers();
  new Headers(headers).forEach((value, name) => {
    if (SAFE_REQUEST_HEADERS.has(name.toLowerCase())) sanitized.set(name, value.slice(0, 500));
  });
  return sanitized;
};

export const projectSdkHttpError = (error: SdkHttpError): {
  response: Response;
  responseBody: unknown;
} => {
  const responseBody = error.responseBody;
  const headers = new Headers(error.headers);
  let compatibilityResponseBody = responseBody ?? null;
  let body: string | null = null;
  if (error.bodyKind === 'json' && responseBody !== undefined) {
    body = JSON.stringify(responseBody);
    headers.set('content-type', 'application/json');
  }
  else if (error.bodyKind === 'text' && typeof responseBody === 'string') {
    body = responseBody;
    if (!headers.has('content-type')) headers.set('content-type', 'text/plain');
  }
  else {
    compatibilityResponseBody = null;
    headers.delete('content-type');
  }

  return {
    response: new Response(body, {
      status: error.status ?? 500,
      headers,
    }),
    responseBody: compatibilityResponseBody,
  };
};
