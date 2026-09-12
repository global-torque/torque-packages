import type { AnalyticsBody } from '@webdevelop-pro/domain-types/analyticsTypes';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REDACTED_VALUE = '[redacted]';
const REDACTED_BODY: AnalyticsBody = { redacted: true };
const SENSITIVE_EXACT_KEYS = new Set([
  'address',
  'address1',
  'address2',
  'city',
  'country',
  'account_holder_name',
  'code',
  'dob',
  'email',
  'first_name',
  'full_name',
  'ip_address',
  'last_name',
  'middle_name',
  'postal_code',
  'state',
  'wallet',
  'user_browser',
  'zip',
  'zip_code',
]);
const MAX_STRING_LENGTH = 500;
const SENSITIVE_KEY_SUBSTRINGS = [
  'account_number',
  'csrf',
  'passcode',
  'password',
  'routing_number',
  'secret',
  'social_security',
  'ssn',
  'tax_id',
  'totp',
] as const;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGIT_PATTERN = /\d{10,}/g;
const JWT_LIKE_PATTERN = /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_TOKEN_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const SECRET_ASSIGNMENT_PATTERN = /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|csrf[_-]?token|session[_-]?token|token|secret|client[_-]?secret|api[_-]?key|authorization|auth[_-]?code|verification[_-]?code|recovery[_-]?code|password|passcode|otp|totp|pin)\b\s*[:=]\s*("[^"]*"|'[^']*'|(?:Bearer|Basic)\s+[^\s,;&]+|[^\s,;&]+)/gi;

export const sanitizeAnalyticsText = (
  raw: unknown,
  maxLength = MAX_STRING_LENGTH,
): string => {
  if (raw == null) {
    return '';
  }

  let sanitized = String(raw)
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1=[redacted]')
    .replace(BEARER_TOKEN_PATTERN, '$1 [redacted]')
    .replace(JWT_LIKE_PATTERN, REDACTED_VALUE)
    .replace(EMAIL_PATTERN, REDACTED_VALUE)
    .replace(LONG_DIGIT_PATTERN, REDACTED_VALUE);

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.slice(0, maxLength - 3)}...`;
  }

  return sanitized;
};

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (SENSITIVE_EXACT_KEYS.has(normalized)) {
    return true;
  }

  if (SENSITIVE_KEY_SUBSTRINGS.some((fragment) => normalized.includes(fragment))) {
    return true;
  }

  if (
    normalized === 'token'
    || normalized.endsWith('token')
    || normalized.startsWith('token')
    || normalized.endsWith('_token')
    || normalized.startsWith('token_')
  ) {
    return true;
  }

  return (
    normalized === 'otp'
    || normalized === 'pin'
    || normalized.endsWith('_otp')
    || normalized.endsWith('_pin')
    || normalized.endsWith('otp')
    || normalized.endsWith('pin')
    || (
      (normalized.endsWith('_code') || normalized.endsWith('code'))
      && (
        normalized.includes('otp')
        || normalized.includes('totp')
        || normalized.includes('pin')
        || normalized.includes('verification')
        || normalized.includes('recovery')
      )
    )
  );
};

const isBlobSupported = () => typeof Blob !== 'undefined';
const isFormDataSupported = () => typeof FormData !== 'undefined';
const isFileSupported = () => typeof File !== 'undefined';

const normalizeBinaryValue = (value: Blob): string => {
  if (isFileSupported() && value instanceof File && value.name.trim()) {
    return '[binary]';
  }

  return '[binary]';
};

const normalizeObjectValue = (
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): AnalyticsBody => {
  seen.add(value);

  const normalized = Object.entries(value).reduce<AnalyticsBody>((result, [key, item]) => {
    result[key] = isSensitiveKey(key)
      ? REDACTED_VALUE
      : normalizeBodyValue(item, seen);
    return result;
  }, {});

  seen.delete(value);
  return normalized;
};

const appendFormDataEntry = (
  target: AnalyticsBody,
  key: string,
  value: unknown,
) => {
  const currentValue = target[key];

  if (typeof currentValue === 'undefined') {
    target[key] = value;
    return;
  }

  target[key] = Array.isArray(currentValue)
    ? [...currentValue, value]
    : [currentValue, value];
};

const normalizeFormData = (
  formData: FormData,
  seen: WeakSet<object>,
): AnalyticsBody => {
  const normalized: AnalyticsBody = {};

  for (const [key, value] of formData.entries()) {
    appendFormDataEntry(
      normalized,
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : normalizeBodyValue(value, seen),
    );
  }

  return normalized;
};

const normalizeBodyValue = (
  value: unknown,
  seen: WeakSet<object>,
): unknown => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return sanitizeAnalyticsText(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isBlobSupported() && value instanceof Blob) {
    return normalizeBinaryValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeBodyValue(item, seen));
  }

  if (isFormDataSupported() && value instanceof FormData) {
    return normalizeFormData(value, seen);
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[circular]';
    }

    return normalizeObjectValue(value as Record<string, unknown>, seen);
  }

  return String(value);
};

export const normalizeAnalyticsBody = (value: unknown): AnalyticsBody => {
  if (value == null) {
    return {};
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return {};
    }

    try {
      return normalizeAnalyticsBody(JSON.parse(trimmedValue));
    } catch {
      return {};
    }
  }

  if (isFormDataSupported() && value instanceof FormData) {
    return normalizeFormData(value, new WeakSet<object>());
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return normalizeObjectValue(value as Record<string, unknown>, new WeakSet<object>());
};

export const normalizeAnalyticsBodyForMethod = (
  method: string | undefined,
  value: unknown,
): AnalyticsBody => {
  if (!method || !MUTATION_METHODS.has(method.toUpperCase())) {
    return {};
  }

  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return {};
  }

  return { ...REDACTED_BODY };
};
