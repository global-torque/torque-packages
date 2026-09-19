import { SdkHttpError } from '@global-torque/sdk';
import type { APIErrorData } from '../service/handlers/apiError.ts';
import {
  isCredentialKey,
  sanitizeAnalyticsText,
  sanitizeAnalyticsUrl,
} from '@global-torque/invest-core/analytics/analyticsBody';

export const sanitizeCompatibilityUrl = (value: string): string => {
  return sanitizeAnalyticsUrl(value);
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
    sanitized.set(
      name,
      isCredentialKey(name) ? '[redacted]' : sanitizeAnalyticsText(value),
    );
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
