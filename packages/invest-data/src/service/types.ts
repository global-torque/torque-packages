/**
 * Response shape from ApiClient. For 204/205 No Content, `data` is undefined.
 */
export interface ApiResponse<T> {
  data: T | undefined;
  status: number;
  headers: Headers;
  /** Total transport attempts made before this response or offline fallback was returned. */
  attempts: number;
  /** Request-local correlation ID created by the compatibility client. */
  clientRequestId: string;
}

export interface RequestConfig extends RequestInit {
  baseURL?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Response body type. 'stream' is reserved for future use (ReadableStream). */
  type?: 'json' | 'blob' | 'text' | 'arrayBuffer' | 'stream';
  /** When true, sends a 'simple' request (no default X-Request-ID / Content-Type headers). Useful for 3rd-party CORS-safe GETs. */
  simple?: boolean;
  /**
   * When true, 5xx responses will be treated as fatal by the
   * global error handler and can trigger a /500 redirect.
   * Defaults to false so that API 5xx errors are surfaced locally
   * (e.g. via toast) without breaking the whole app. Set to true
   * only for requests where a server error should be considered
   * unrecoverable for the current UI flow.
   */
  fatalOnServerError?: boolean;
  /**
   * When false, 5xx responses for this request will NOT trigger
   * a global alert banner in the shared error reporter.
   * Defaults to true so core domains surface 5xx as a banner;
   * set to false for non-core domains (e.g. analytics, notifications).
   */
  showGlobalAlertOnServerError?: boolean;
  /**
   * Allows a mutation request to proceed while offline.
   * Defaults to false so write actions are blocked in read-only offline mode.
   */
  allowOfflineMutation?: boolean;
  /** Disable IndexedDB fallback when the caller requires an authoritative network read. */
  offlineFallback?: boolean;
  /**
   * Number of extra attempts for transport-level network failures before throwing.
   * Defaults to 1 for idempotent GET/OPTIONS requests and 0 for mutations.
   */
  retry?: number;
  /**
   * Base delay between network retry attempts in milliseconds.
   * Delay is multiplied by the attempt number for a small linear backoff.
   */
  retryDelayMs?: number;
  /** Canonical mutation idempotency key. Sent as Idempotency-Key by the SDK transport. */
  idempotencyKey?: string;
  /** Temporary legacy-facade timeout override in milliseconds; null disables the transport timeout. */
  timeoutMs?: number | null;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
