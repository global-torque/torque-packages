import { useClientIp } from '../client/useClientIp.ts';

export interface HttpRequestLike {
  method: string;
  url: string;
  path: string;
  userAgent: string;
  referer: string;
  remoteIp: string;
  protocol: string;
}

const stripQueryAndHash = (value: string): string => value.split('?')[0]?.split('#')[0] ?? value;

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

  // Build a safe URL for analytics: strip query/hash to avoid leaking sensitive data
  const rawUrl = httpRequest?.url ?? urlValue;
  let safeUrl = rawUrl;
  try {
    if (rawUrl) {
      const base = typeof window !== 'undefined' ? window.location.origin : undefined;
      const parsed = new URL(rawUrl, base);
      safeUrl = `${parsed.origin}${parsed.pathname}`;
    }
  } catch {
    // Fallback: prefer path-only value if available
    safeUrl = pathValue || rawUrl || '';
  }

  return {
    method: httpRequest?.method ?? 'GET',
    url: safeUrl,
    path: stripQueryAndHash(httpRequest?.path ?? pathValue),
    userAgent: httpRequest?.userAgent ?? userAgentValue,
    referer: httpRequest?.referer ?? (typeof document !== 'undefined' ? document.referrer || '-' : '-'),
    remoteIp: resolvedRemoteIp,
    protocol: httpRequest?.protocol ?? (typeof window !== 'undefined' ? window.location.protocol : ''),
  };
};
