import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  buildWorkboxRuntimeCaching,
  matchOfflineDomainPolicy,
  matchesPathPattern,
  matchesPathPrefix,
  PWA_CACHE_NAMES,
  PWA_PRIVATE_CACHE_NAMES,
  type RuntimeCacheRule,
  resolveOfflineDomainPolicies,
} from '../pwaPolicy.ts';

const TEST_ENV = {
  FRONTEND_URL: 'https://frontend.test',
  OFFER_URL: 'https://offer.test',
  USER_URL: 'https://user.test',
  INVESTMENT_URL: 'https://investment.test',
  WALLET_URL: 'https://wallet.test',
  EVM_URL: 'https://evm.test',
  FILER_URL: 'https://filer.test',
  DISTRIBUTIONS_URL: 'https://distributions.test',
  ACCREDITATION_URL: 'https://accreditation.test',
  KRATOS_URL: 'https://kratos.test',
} as const;

type UrlPatternMatcher = Exclude<RuntimeCacheRule['urlPattern'], RegExp>;
type UrlPatternMatcherContext = Parameters<UrlPatternMatcher>[0];

const getUrlPatternMatcher = (matcher: unknown): UrlPatternMatcher => {
  expect(typeof matcher).toBe('function');
  return matcher as UrlPatternMatcher;
};

const evaluateSerializedMatcher = (matcher: unknown) => {
  const urlPatternMatcher = getUrlPatternMatcher(matcher);

  return Function(`return (${urlPatternMatcher.toString()})`)() as UrlPatternMatcher;
};

describe('matchOfflineDomainPolicy', () => {
  it('matches path prefixes and regex path patterns', () => {
    expect(matchesPathPrefix('/dashboard/portfolio', '/dashboard')).toBe(true);
    expect(matchesPathPrefix('/offers', '/dashboard')).toBe(false);
    expect(matchesPathPattern('/public/files/123', '/public/files')).toBe(true);
    expect(matchesPathPattern('/auth/report/123', /^\/auth\/report\/\d+$/)).toBe(true);
  });

  it('matches any GET under safe first-party business domains', () => {
    expect(matchOfflineDomainPolicy('https://offer.test/public/offer/featured', 'GET', TEST_ENV)?.key)
      .toBe('offer-api');
    expect(matchOfflineDomainPolicy('https://user.test/auth/preferences', 'GET', TEST_ENV)?.key)
      .toBe('user-api');
    expect(matchOfflineDomainPolicy('https://investment.test/auth/invest/custom-report/42', 'GET', TEST_ENV)?.key)
      .toBe('investment-api');
    expect(matchOfflineDomainPolicy('https://wallet.test/auth/balance/history', 'GET', TEST_ENV)?.key)
      .toBe('wallet-api');
    expect(matchOfflineDomainPolicy('https://evm.test/auth/assets/positions', 'GET', TEST_ENV)?.key)
      .toBe('evm-api');
    expect(matchOfflineDomainPolicy('https://distributions.test/auth/123/export', 'GET', TEST_ENV)?.key)
      .toBe('distributions-api');
    expect(matchOfflineDomainPolicy('https://accreditation.test/auth/review/123', 'GET', TEST_ENV)?.key)
      .toBe('accreditation-api');
  });

  it('keeps filer object metadata and binaries out of offline API persistence', () => {
    expect(matchOfflineDomainPolicy('https://filer.test/public/objects/offer/12', 'GET', TEST_ENV))
      .toBeNull();
    expect(matchOfflineDomainPolicy('https://filer.test/public/files/12?size=big', 'GET', TEST_ENV))
      .toBeNull();
    expect(matchOfflineDomainPolicy('https://api.test/filer-api/v1.0/public/files/12?size=big', 'GET', {
      ...TEST_ENV,
      FILER_URL: 'https://api.test/filer-api/v1.0',
    })).toBeNull();
    expect(matchOfflineDomainPolicy('https://filer.test/private/files/12', 'GET', TEST_ENV))
      .toBeNull();
    expect(matchOfflineDomainPolicy('https://api.test/filer-api/v1.0/private/files/12', 'GET', {
      ...TEST_ENV,
      FILER_URL: 'https://api.test/filer-api/v1.0',
    })).toBeNull();
  });

  it('does not cache excluded or non-GET requests', () => {
    expect(matchOfflineDomainPolicy('https://kratos.test/sessions/whoami', 'GET', TEST_ENV))
      .toBeNull();
    expect(matchOfflineDomainPolicy('https://notifications.test/notification', 'GET', TEST_ENV))
      .toBeNull();
    expect(matchOfflineDomainPolicy('https://offer.test/public/offer', 'POST', TEST_ENV))
      .toBeNull();
  });

  it('returns null for invalid request urls or unresolved service origins', () => {
    expect(matchOfflineDomainPolicy('not-a-url', 'GET', TEST_ENV)).toBeNull();
    expect(matchOfflineDomainPolicy('https://offer.test/public/offer', 'GET', {
      ...TEST_ENV,
      OFFER_URL: 'not-a-valid-origin',
    })).toBeNull();
  });

  it('does not match requests that fall outside the configured service pathname', () => {
    expect(matchOfflineDomainPolicy('https://offer.test/other/path', 'GET', {
      ...TEST_ENV,
      OFFER_URL: 'https://offer.test/public',
    })).toBeNull();
  });
});

describe('policy helpers', () => {
  it('resolves offline domain policies only for valid configured urls', () => {
    const policies = resolveOfflineDomainPolicies({
      FRONTEND_URL: 'https://frontend.test/app',
      OFFER_URL: 'https://offer.test/api',
      USER_URL: undefined,
      INVESTMENT_URL: 'not-a-url',
    });

    expect(policies.map((policy) => policy.key)).toEqual([
      'frontend-navigation',
      'offer-api',
    ]);
    expect(policies[0]?.normalizedPathname).toBe('/app/');
  });
});

describe('buildWorkboxRuntimeCaching', () => {
  const getNavigationRule = (
    options?: Parameters<typeof buildWorkboxRuntimeCaching>[1],
  ) => {
    const runtimeRules = buildWorkboxRuntimeCaching(TEST_ENV, options);

    return runtimeRules.find((rule) => rule.options.cacheName === PWA_CACHE_NAMES.frontendShell);
  };

  const getNavigationPlugins = (
    options?: Parameters<typeof buildWorkboxRuntimeCaching>[1],
  ) => {
    const navigationRule = getNavigationRule(options);

    return navigationRule?.options.plugins as Array<{
      fetchDidSucceed?: (context: { request: Request; response: Response }) => Promise<Response>;
      handlerDidError?: (context: { request?: Request }) => Promise<Response>;
    }> | undefined;
  };

  const getNavigationFallbackPlugin = () => (
    getNavigationPlugins()?.find((plugin) => typeof plugin.handlerDidError === 'function')
  );

  const getEvictStalePlugin = () => (
    getNavigationPlugins()?.filter((plugin) => typeof plugin.fetchDidSucceed === 'function').at(-1)
  );

  const evaluateSerializedHandler = <T extends (...args: any[]) => unknown>(handler: T) => (
    Function(`return (${handler.toString()})`)() as T
  );

  it('never registers URL-only CacheStorage rules for private API responses', () => {
    const cacheNames = buildWorkboxRuntimeCaching(TEST_ENV)
      .map(rule => rule.options.cacheName);

    expect(cacheNames).not.toEqual(expect.arrayContaining([...PWA_PRIVATE_CACHE_NAMES]));
    expect(cacheNames).toEqual(expect.arrayContaining([
      PWA_CACHE_NAMES.frontendShell,
      PWA_CACHE_NAMES.offerApi,
    ]));
    expect(cacheNames).not.toContain(PWA_CACHE_NAMES.filerPublicApi);
  });

  it('keeps generated navigation fallback callbacks self-contained after service worker serialization', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const serializedHandler = evaluateSerializedHandler(navigationFallbackPlugin?.handlerDidError as NonNullable<typeof navigationFallbackPlugin>['handlerDidError']);
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<html>offer detail</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await serializedHandler({
      request: new Request('https://frontend.test/city-of-springfield-2025-bond'),
    });

    expect(await response.text()).toContain('offer detail');
    expect(cachesMatchMock).toHaveBeenCalledWith('/city-of-springfield-2025-bond', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('keeps dashboard shell fallback available for host workers without navigation exclusions', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<html>dashboard shell</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({
      request: new Request('https://frontend.test/dashboard/portfolio'),
    });

    expect(await response?.text()).toContain('dashboard shell');
    expect(cachesMatchMock).toHaveBeenCalledWith('/dashboard/index.html', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('prefers the cached offer detail route before offline.html for offer detail navigations', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<html>offer detail</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({
      request: new Request('https://frontend.test/city-of-springfield-2025-bond'),
    });

    expect(await response?.text()).toContain('offer detail');
    expect(cachesMatchMock).toHaveBeenNthCalledWith(1, '/city-of-springfield-2025-bond', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('prefers warmed static section routes before offline.html', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Response('<html>offers</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({
      request: new Request('https://frontend.test/offers'),
    });

    expect(await response?.text()).toContain('offers');
    expect(cachesMatchMock).toHaveBeenNthCalledWith(1, '/offers', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(2, '/offers.html', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('keeps stale response eviction callbacks self-contained after service worker serialization', async () => {
    const evictStalePlugin = getEvictStalePlugin();
    const serializedFetchDidSucceed = evaluateSerializedHandler(evictStalePlugin?.fetchDidSucceed as (context: {
      request: Request;
      response: Response;
    }) => Promise<Response>);
    const cacheDeleteMock = vi.fn();
    const cachesOpenMock = vi.fn().mockResolvedValue({
      delete: cacheDeleteMock,
    });
    const request = new Request('https://frontend.test/dashboard/missing');
    const response = new Response('not found', { status: 404 });

    vi.stubGlobal('caches', {
      open: cachesOpenMock,
    });

    const result = await serializedFetchDidSucceed({ request, response });

    expect(result).toBe(response);
    expect(cachesOpenMock).toHaveBeenCalledWith(PWA_CACHE_NAMES.frontendShell);
    expect(cacheDeleteMock).toHaveBeenCalledWith(request);

    vi.unstubAllGlobals();
  });

  it('falls back to offline.html when an offer detail route is not cached', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Response('<html>offline fallback</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({
      request: new Request('https://frontend.test/city-of-springfield-2025-bond'),
    });

    expect(await response?.text()).toContain('offline fallback');
    expect(cachesMatchMock).toHaveBeenNthCalledWith(1, '/city-of-springfield-2025-bond', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(2, '/city-of-springfield-2025-bond.html', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(3, '/city-of-springfield-2025-bond/index.html', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(4, '/index.html', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(5, '/offline.html', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('keeps dashboard.html fallback available for host workers without navigation exclusions', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Response('<html>dashboard fallback</html>'));

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({
      request: new Request('https://frontend.test/dashboard'),
    });

    expect(await response?.text()).toContain('dashboard fallback');
    expect(cachesMatchMock).toHaveBeenNthCalledWith(1, '/dashboard/index.html', { ignoreSearch: true });
    expect(cachesMatchMock).toHaveBeenNthCalledWith(2, '/dashboard.html', { ignoreSearch: true });

    vi.unstubAllGlobals();
  });

  it('omits dashboard shell fallback references when dashboard navigations are excluded', () => {
    const navigationPlugins = getNavigationPlugins({
      excludeNavigationPathPrefixes: ['/dashboard'],
    });
    const navigationFallbackPlugin = navigationPlugins?.find((plugin) => typeof plugin.handlerDidError === 'function');
    const serializedHandler = navigationFallbackPlugin?.handlerDidError?.toString() ?? '';

    expect(serializedHandler).not.toContain('/dashboard/index.html');
    expect(serializedHandler).not.toContain('/dashboard.html');
  });

  it('returns a response error when no offline fallback is cached', async () => {
    const navigationFallbackPlugin = getNavigationFallbackPlugin();
    const cachesMatchMock = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('caches', {
      match: cachesMatchMock,
    });

    const response = await navigationFallbackPlugin?.handlerDidError?.({});

    expect(response).toBeInstanceOf(Response);
    expect(response?.type).toBe('error');

    vi.unstubAllGlobals();
  });

  it('does not create a generic filer runtime cache rule', () => {
    const runtimeRules = buildWorkboxRuntimeCaching({
      ...TEST_ENV,
      FILER_URL: 'https://api.test/filer-api/v1.0',
    });
    const filerPublicRule = runtimeRules.find((rule) => rule.options.cacheName === PWA_CACHE_NAMES.filerPublicApi);
    expect(filerPublicRule).toBeUndefined();
  });

  it('builds a navigation rule that only matches same-origin navigation requests by default', () => {
    vi.stubGlobal('self', {
      location: {
        origin: 'https://frontend.test',
      },
    });

    const runtimeRules = buildWorkboxRuntimeCaching(TEST_ENV);
    const navigationRule = runtimeRules.find((rule) => rule.options.cacheName === PWA_CACHE_NAMES.frontendShell);
    const navigationMatcher = getUrlPatternMatcher(navigationRule?.urlPattern);
    const createMatcherContext = (
      mode: RequestMode,
      url: string,
    ): UrlPatternMatcherContext => ({
      request: {
        mode,
        method: 'GET',
      } as Request,
      url: new URL(url),
    });
    const matchesNavigation = navigationMatcher(createMatcherContext('navigate', 'https://frontend.test/offers'));
    const matchesDashboardNavigation = navigationMatcher(createMatcherContext('navigate', 'https://frontend.test/dashboard/portfolio'));
    const rejectsCrossOrigin = navigationMatcher(createMatcherContext('navigate', 'https://offer.test/public/offer'));
    const rejectsNonNavigation = navigationMatcher(createMatcherContext('cors', 'https://frontend.test/offers'));

    expect(matchesNavigation).toBe(true);
    expect(matchesDashboardNavigation).toBe(true);
    expect(rejectsCrossOrigin).toBe(false);
    expect(rejectsNonNavigation).toBe(false);

    vi.unstubAllGlobals();
  });

  it('can exclude dashboard paths from same-origin navigation matching', () => {
    vi.stubGlobal('self', {
      location: {
        origin: 'https://frontend.test',
      },
    });

    const runtimeRules = buildWorkboxRuntimeCaching(TEST_ENV, {
      excludeNavigationPathPrefixes: ['/dashboard'],
    });
    const navigationRule = runtimeRules.find((rule) => rule.options.cacheName === PWA_CACHE_NAMES.frontendShell);
    const navigationMatcher = getUrlPatternMatcher(navigationRule?.urlPattern);
    const serializedNavigationMatcher = evaluateSerializedMatcher(navigationRule?.urlPattern);
    const createMatcherContext = (url: string): UrlPatternMatcherContext => ({
      request: {
        mode: 'navigate',
        method: 'GET',
      } as Request,
      url: new URL(url),
    });
    const assertMatcherBehavior = (matcher: UrlPatternMatcher) => {
      expect(matcher(createMatcherContext('https://frontend.test/dashboard'))).toBe(false);
      expect(matcher(createMatcherContext('https://frontend.test/dashboard/'))).toBe(false);
      expect(matcher(createMatcherContext('https://frontend.test/dashboard/profile/123/portfolio'))).toBe(false);
      expect(matcher(createMatcherContext('https://frontend.test/'))).toBe(true);
      expect(matcher(createMatcherContext('https://frontend.test/offers'))).toBe(true);
      expect(matcher(createMatcherContext('https://frontend.test/dashboardish'))).toBe(true);
    };

    assertMatcherBehavior(navigationMatcher);
    assertMatcherBehavior(serializedNavigationMatcher);

    vi.unstubAllGlobals();
  });
});
