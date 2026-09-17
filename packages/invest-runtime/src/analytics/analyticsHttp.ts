import { useClientIp } from '../client/useClientIp.ts';
import { sanitizeAnalyticsUrl } from '@global-torque/invest-core/analytics/analyticsBody';

export interface HttpRequestLike {
  method: string;
  url: string;
  path: string;
  userAgent: string;
  referer: string;
  remoteIp: string;
  protocol: string;
}

export const buildHttpRequest = (httpRequest?: Partial<HttpRequestLike>): HttpRequestLike => {
  const pathValue = typeof window !== 'undefined' ? window.location.pathname : '';
  const urlValue = typeof window !== 'undefined' ? window.location.href : '';
  const userAgentValue = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const { ip, fetchIp } = useClientIp();

  // Best-effort background IP resolution when not explicitly provided
  if (!httpRequest?.remoteIp && typeof window !== 'undefined') {
    void fetchIp();
  }

  const resolvedRemoteIp =
    httpRequest?.remoteIp && httpRequest.remoteIp.trim()
      ? httpRequest.remoteIp
      : ip.value ?? '-';

  // Preserve useful query and fragment context while masking known credentials.
  const rawUrl = httpRequest?.url ?? urlValue;
  const safeUrl = sanitizeAnalyticsUrl(rawUrl || pathValue || '');

  return {
    method: httpRequest?.method ?? 'GET',
    url: safeUrl,
    path: sanitizeAnalyticsUrl(httpRequest?.path ?? pathValue),
    userAgent: httpRequest?.userAgent ?? userAgentValue,
    referer: sanitizeAnalyticsUrl(
      httpRequest?.referer
        ?? (typeof document !== 'undefined' ? document.referrer || '-' : '-'),
    ),
    remoteIp: resolvedRemoteIp,
    protocol: httpRequest?.protocol ?? (typeof window !== 'undefined' ? window.location.protocol : ''),
  };
};
