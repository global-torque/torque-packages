import type { AnalyticsBody } from '@global-torque/domain-types/analyticsTypes';

const REDACTED_VALUE = '[redacted]';
const MAX_STRING_LENGTH = 500;

/**
 * Credential names are matched exactly after converting camel, kebab and
 * spaced names to snake case. Business fields such as `token_symbol`,
 * `token_count`, and `tokenNote` remain available.
 */
const CREDENTIAL_KEYS = new Set([
  'password',
  'create_password',
  'repeat_password',
  'current_password',
  'new_password',
  'confirm_password',
  'token',
  'jwt_token',
  'access_token',
  'refresh_token',
  'id_token',
  'auth_token',
  'session_token',
  'session_token_exchange_code',
  'csrf',
  'csrf_token',
  'xsrf_token',
  'authorization',
  'proxy_authorization',
  'cookie',
  'set_cookie',
  'api_key',
  'x_api_key',
  'secret',
  'client_secret',
  'private_key',
  'seed_phrase',
  'mnemonic',
  'passcode',
  'otp',
  'totp',
  'pin',
  'auth_code',
  'verification_code',
  'recovery_code',
  'totp_code',
  'link_token',
  'challenge_signature',
  'owner_signature',
]);
const COMPACT_CREDENTIAL_KEYS = new Set(
  [...CREDENTIAL_KEYS].map((key) => key.replaceAll('_', '')),
);

const BEARER_TOKEN_PATTERN = /\b(Bearer|Basic)\s+[^\s,;&"'<>]+/giu;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/giu;
const RELATIVE_URL_PATTERN = /(^|[\s("'=])((?:\/{1,2}|\.\.?\/)[^\s"'<>]+)/gmu;
const CREDENTIAL_HEADER_PATTERN = /(^|[^"'A-Za-z0-9_-])(cookie|set-cookie|authorization|proxy-authorization)\s*:\s*[^\r\n]*/gimu;

/** Convert supported key spellings to one exact comparison form. */
export const normalizeAnalyticsKey = (key: string): string => key
  .trim()
  .replace(/([a-z\d])([A-Z])/g, '$1_$2')
  .replace(/[^A-Za-z\d]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toLowerCase();

export const isCredentialKey = (key: string): boolean =>
  CREDENTIAL_KEYS.has(normalizeAnalyticsKey(key))
  || COMPACT_CREDENTIAL_KEYS.has(normalizeAnalyticsKey(key).replaceAll('_', ''));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const CREDENTIAL_KEY_SPELLINGS = new Set(
  [...CREDENTIAL_KEYS].flatMap((key) => [
    key,
    key.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase()),
    key.replaceAll('_', '-'),
    key.replaceAll('_', ''),
  ]),
);
const CREDENTIAL_ASSIGNMENT_PATTERN = new RegExp(
  `(?<![A-Za-z0-9_-])(["']?)(${[...CREDENTIAL_KEY_SPELLINGS].map(escapeRegExp).join('|')})\\1(\\s*[:=]\\s*)(?:(['"])((?:\\\\.|(?!\\4)[\\s\\S])*)\\4|([^\\s,;&}{"']+))`,
  'giu',
);

/** Mask a credential assignment while retaining its label and surrounding text. */
const maskCredentialAssignments = (value: string): string => value.replace(
  CREDENTIAL_ASSIGNMENT_PATTERN,
  (
    match,
    quote: string,
    key: string,
    separator: string,
    valueQuote?: string,
    quotedValue?: string,
    unquotedValue?: string,
  ) => {
    const rawValue = quotedValue ?? unquotedValue ?? '';
    if (
      rawValue === REDACTED_VALUE
      || /^%5bredacted%5d$/iu.test(rawValue)
      || /^(?:Bearer|Basic)\s+\[redacted\]$/iu.test(rawValue)
    ) return match;
    return `${quote}${key}${quote}${separator}${valueQuote ? `${valueQuote}${REDACTED_VALUE}${valueQuote}` : REDACTED_VALUE}`;
  },
);

const maskCredentialHeaders = (value: string): string => value.replace(
  CREDENTIAL_HEADER_PATTERN,
  (match, prefix: string, key: string) => `${prefix}${key}: [redacted]`,
);

const hasAbsoluteScheme = (value: string): boolean => /^[A-Za-z][A-Za-z\d+.-]*:/u.test(value);
const hasProtocolRelativePrefix = (value: string): boolean => value.startsWith('//');

const redactPathCredentialValues = (pathname: string): string => {
  const segments = pathname.split('/');
  return segments.map((segment, index) => {
    const previous = segments[index - 1] ?? '';
    let decodedPrevious = previous;
    try {
      decodedPrevious = decodeURIComponent(previous);
    } catch {
      // Keep the encoded segment when it is not valid URI encoding.
    }
    return isCredentialKey(decodedPrevious) ? '[redacted]' : segment;
  }).join('/');
};

const maskCredentialFragment = (fragment: string): string => {
  if (!fragment) return fragment;
  const rawFragment = fragment.slice(1);
  if (rawFragment.includes('=')) {
    const params = new URLSearchParams(rawFragment);
    const entries = [...params.entries()];
    if (entries.some(([key]) => isCredentialKey(key))) {
      const next = new URLSearchParams();
      entries.forEach(([key, value]) => next.append(key, isCredentialKey(key) ? REDACTED_VALUE : value));
      return `#${next.toString()}`;
    }
  }
  return maskCredentialAssignments(fragment);
};

/** Preserve useful URL data while removing only known credential locations. */
export const sanitizeAnalyticsUrl = (raw: string): string => {
  if (!raw) return '';

  const absolute = hasAbsoluteScheme(raw);
  const protocolRelative = hasProtocolRelativePrefix(raw);
  const base = 'https://analytics.local';

  try {
    const url = new URL(raw, base);
    url.username = '';
    url.password = '';
    url.pathname = redactPathCredentialValues(url.pathname);

    const entries = [...url.searchParams.entries()];
    url.search = '';
    entries.forEach(([key, value]) => {
      url.searchParams.append(key, isCredentialKey(key) ? '[redacted]' : value);
    });
    url.hash = maskCredentialFragment(url.hash);

    const serialized = url.toString();
    if (absolute) return serialized;
    if (protocolRelative) return `//${url.host}${url.pathname}${url.search}${url.hash}`;

    const originalHadPath = raw.startsWith('/') || (!raw.startsWith('?') && !raw.startsWith('#'));
    const relativePrefix = raw.match(/^(?:\.\.?\/)+/u)?.[0] ?? '';
    const relativePath = originalHadPath ? url.pathname.replace(/^\//u, '') : '';
    return `${raw.startsWith('/') ? url.pathname : `${relativePrefix}${relativePath}`}${url.search}${url.hash}`;
  } catch {
    return maskCredentialAssignments(raw);
  }
};

/**
 * Sanitize free-form diagnostics without treating ordinary user/business data
 * as sensitive. Embedded URLs are processed first so useful URL context stays.
 */
export const sanitizeAnalyticsText = (
  raw: unknown,
  maxLength = MAX_STRING_LENGTH,
): string => {
  if (raw == null) return '';

  let sanitized = String(raw)
    .replace(URL_PATTERN, (url) => sanitizeAnalyticsUrl(url))
    .replace(RELATIVE_URL_PATTERN, (match, prefix: string, url: string) => (
      `${prefix}${sanitizeAnalyticsUrl(url)}`
    ))
    .replace(BEARER_TOKEN_PATTERN, '$1 [redacted]');
  sanitized = maskCredentialHeaders(sanitized);
  sanitized = maskCredentialAssignments(sanitized);

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  return sanitized;
};

const isBlobSupported = () => typeof Blob !== 'undefined';
const isFormDataSupported = () => typeof FormData !== 'undefined';
const isUrlSearchParamsSupported = () => typeof URLSearchParams !== 'undefined';
const isFileSupported = () => typeof File !== 'undefined';

const normalizeBinaryValue = (value: Blob): string => {
  if (isFileSupported() && value instanceof File && value.name.trim()) return '[binary]';
  return '[binary]';
};

const isAuthCodeRecord = (value: Record<string, unknown>): boolean => {
  const hasMethodCode = Object.entries(value).some(([key, item]) =>
    normalizeAnalyticsKey(key) === 'method' && item === 'code');
  const hasCsrfToken = Object.keys(value).some((key) =>
    normalizeAnalyticsKey(key) === 'csrf_token');
  return hasMethodCode && hasCsrfToken;
};

const appendRepeatedValue = (target: AnalyticsBody, key: string, value: unknown): void => {
  const currentValue = target[key];
  if (typeof currentValue === 'undefined') {
    target[key] = value;
  } else {
    target[key] = Array.isArray(currentValue)
      ? [...currentValue, value]
      : [currentValue, value];
  }
};

const normalizeFormData = (formData: FormData, seen: WeakSet<object>): AnalyticsBody => {
  seen.add(formData);
  const entries = [...formData.entries()];
  const hasMethodCode = entries.some(([key, value]) => normalizeAnalyticsKey(key) === 'method' && value === 'code');
  const hasCsrfToken = entries.some(([key]) => normalizeAnalyticsKey(key) === 'csrf_token');
  const normalized: AnalyticsBody = {};

  entries.forEach(([key, value]) => {
    const redactCode = normalizeAnalyticsKey(key) === 'code' && hasMethodCode && hasCsrfToken;
    appendRepeatedValue(
      normalized,
      key,
      isCredentialKey(key) || redactCode ? '[redacted]' : normalizeBodyValue(value, seen),
    );
  });

  seen.delete(formData);
  return normalized;
};

const normalizeUrlSearchParams = (params: URLSearchParams, seen: WeakSet<object>): AnalyticsBody => {
  seen.add(params);
  const entries = [...params.entries()];
  const hasMethodCode = entries.some(([key, value]) => normalizeAnalyticsKey(key) === 'method' && value === 'code');
  const hasCsrfToken = entries.some(([key]) => normalizeAnalyticsKey(key) === 'csrf_token');
  const normalized: AnalyticsBody = {};

  entries.forEach(([key, value]) => {
    const redactCode = normalizeAnalyticsKey(key) === 'code' && hasMethodCode && hasCsrfToken;
    appendRepeatedValue(
      normalized,
      key,
      isCredentialKey(key) || redactCode ? '[redacted]' : normalizeBodyValue(value, seen),
    );
  });

  seen.delete(params);
  return normalized;
};

const normalizeObjectValue = (
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): AnalyticsBody => {
  seen.add(value);
  const redactCode = isAuthCodeRecord(value);
  const normalized = Object.entries(value).reduce<AnalyticsBody>((result, [key, item]) => {
    result[key] = isCredentialKey(key) || (redactCode && normalizeAnalyticsKey(key) === 'code')
      ? '[redacted]'
      : normalizeBodyValue(item, seen);
    return result;
  }, {});
  seen.delete(value);
  return normalized;
};

const normalizeBodyValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value == null) return null;
  if (typeof value === 'string') return sanitizeAnalyticsText(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (isBlobSupported() && value instanceof Blob) return normalizeBinaryValue(value);

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[circular]';
    if (Array.isArray(value)) {
      seen.add(value);
      const normalized = value.map((item) => normalizeBodyValue(item, seen));
      seen.delete(value);
      return normalized;
    }
    if (isFormDataSupported() && value instanceof FormData) return normalizeFormData(value, seen);
    if (isUrlSearchParamsSupported() && value instanceof URLSearchParams) {
      return normalizeUrlSearchParams(value, seen);
    }
    return normalizeObjectValue(value as Record<string, unknown>, seen);
  }

  return String(value);
};

export const normalizeAnalyticsBody = (value: unknown): AnalyticsBody => {
  if (value == null) return {};

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) return {};
    try {
      return normalizeAnalyticsBody(JSON.parse(trimmedValue));
    } catch {
      return {};
    }
  }

  const seen = new WeakSet<object>();
  if (isFormDataSupported() && value instanceof FormData) return normalizeFormData(value, seen);
  if (isUrlSearchParamsSupported() && value instanceof URLSearchParams) {
    return normalizeUrlSearchParams(value, seen);
  }
  if (typeof value !== 'object' || Array.isArray(value)) return {};
  return normalizeObjectValue(value as Record<string, unknown>, seen);
};

/** Normalize every method consistently; method remains part of the public API. */
export const normalizeAnalyticsBodyForMethod = (
  _method: string | undefined,
  value: unknown,
): AnalyticsBody => normalizeAnalyticsBody(value);
