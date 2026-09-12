const PWA_DEBUG_QUERY_PARAM = '__pwa_debug';
const PWA_TEST_QUERY_PARAM = '__pwa_test';
const PWA_DEBUG_LOCAL_STORAGE_KEY = 'invest:pwa:debug';
const PWA_TEST_SESSION_STORAGE_KEY = 'invest:pwa:test';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const isLocalHost = (hostname: string, testHostname?: string) => (
  LOOPBACK_HOSTS.has(hostname)
  || (testHostname !== undefined && hostname === testHostname)
);

const hasQueryParam = (search: string, key: string) => (
  new URLSearchParams(search).has(key)
);

const persistSessionFlag = (key: string) => {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Ignore sessionStorage failures and fall back to query-only detection.
  }
};

const readSessionFlag = (key: string) => {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const getPwaDebugPathname = () => (
  typeof window === 'undefined'
    ? ''
    : window.location.pathname
);

export const isPwaDebugEnabled = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (
    hasQueryParam(window.location.search, PWA_DEBUG_QUERY_PARAM)
    || hasQueryParam(window.location.search, PWA_TEST_QUERY_PARAM)
  ) {
    return true;
  }

  try {
    const value = window.localStorage.getItem(PWA_DEBUG_LOCAL_STORAGE_KEY);
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
};

export const isLocalPwaTestHost = (testHostname?: string) => {
  if (typeof window === 'undefined') {
    return false;
  }

  return isLocalHost(window.location.hostname, testHostname);
};

export const isLocalPwaTestEnabled = (testHostname?: string) => {
  if (!isLocalPwaTestHost(testHostname)) {
    return false;
  }

  if (hasQueryParam(window.location.search, PWA_TEST_QUERY_PARAM)) {
    persistSessionFlag(PWA_TEST_SESSION_STORAGE_KEY);
    return true;
  }

  return readSessionFlag(PWA_TEST_SESSION_STORAGE_KEY);
};

export const toPwaDebugError = (error: unknown) => (
  error instanceof Error
    ? {
      name: error.name,
      message: error.message,
    }
    : error
);

export const logPwaDebug = (
  scope: string,
  message: string,
  details: Record<string, unknown> = {},
) => {
  if (!isPwaDebugEnabled() || typeof console?.log !== 'function') {
    return;
  }

  console.log(`[pwa-debug:${scope}]`, {
    message,
    pathname: getPwaDebugPathname(),
    ...details,
  });
};
