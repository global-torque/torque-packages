// Bumped when cache shape or eviction/fallback logic changes incompatibly.
export const PWA_CACHE_VERSION = 'v3';
export const PWA_CACHE_NAMES = {
    frontendShell: `frontend-shell-cache-${PWA_CACHE_VERSION}`,
    offerApi: `offer-api-cache-${PWA_CACHE_VERSION}`,
    userApi: `user-api-cache-${PWA_CACHE_VERSION}`,
    investmentApi: `investment-api-cache-${PWA_CACHE_VERSION}`,
    walletApi: `wallet-api-cache-${PWA_CACHE_VERSION}`,
    evmApi: `evm-api-cache-${PWA_CACHE_VERSION}`,
    filerPublicApi: `filer-public-api-cache-${PWA_CACHE_VERSION}`,
    filerPrivateApi: `filer-private-api-cache-${PWA_CACHE_VERSION}`,
    distributionsApi: `distributions-api-cache-${PWA_CACHE_VERSION}`,
    accreditationApi: `accreditation-api-cache-${PWA_CACHE_VERSION}`,
};
export const PWA_PUBLIC_CACHE_NAMES = [
    PWA_CACHE_NAMES.frontendShell,
    PWA_CACHE_NAMES.offerApi,
    PWA_CACHE_NAMES.filerPublicApi,
];
export const PWA_PRIVATE_CACHE_NAMES = [
    PWA_CACHE_NAMES.userApi,
    PWA_CACHE_NAMES.investmentApi,
    PWA_CACHE_NAMES.walletApi,
    PWA_CACHE_NAMES.evmApi,
    PWA_CACHE_NAMES.filerPrivateApi,
    PWA_CACHE_NAMES.distributionsApi,
    PWA_CACHE_NAMES.accreditationApi,
];
export const OFFLINE_DOMAINS = [
    {
        key: 'frontend-navigation',
        envKey: 'FRONTEND_URL',
        scope: 'public',
        cacheName: PWA_CACHE_NAMES.frontendShell,
        strategy: 'navigation',
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: false,
    },
    {
        key: 'offer-api',
        envKey: 'OFFER_URL',
        scope: 'public',
        cacheName: PWA_CACHE_NAMES.offerApi,
        strategy: 'network-first',
        maxEntries: 150,
        maxAgeSeconds: 24 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'user-api',
        envKey: 'USER_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.userApi,
        strategy: 'network-first',
        maxEntries: 40,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'investment-api',
        envKey: 'INVESTMENT_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.investmentApi,
        strategy: 'network-first',
        maxEntries: 80,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'wallet-api',
        envKey: 'WALLET_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.walletApi,
        strategy: 'network-first',
        maxEntries: 60,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'evm-api',
        envKey: 'EVM_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.evmApi,
        strategy: 'network-first',
        maxEntries: 40,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'distributions-api',
        envKey: 'DISTRIBUTIONS_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.distributionsApi,
        strategy: 'network-first',
        maxEntries: 20,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
    {
        key: 'accreditation-api',
        envKey: 'ACCREDITATION_URL',
        scope: 'private',
        cacheName: PWA_CACHE_NAMES.accreditationApi,
        strategy: 'network-first',
        maxEntries: 20,
        maxAgeSeconds: 12 * 60 * 60,
        networkTimeoutSeconds: 3,
        persistToIndexedDb: true,
    },
];
const normalizePathPrefix = (value) => (value.endsWith('/') ? value : `${value}/`);
const normalizeNavigationPathPrefix = (value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return '';
    }
    const prefixedValue = trimmedValue.startsWith('/')
        ? trimmedValue
        : `/${trimmedValue}`;
    return prefixedValue === '/'
        ? '/'
        : prefixedValue.replace(/\/+$/, '');
};
const normalizeNavigationPathPrefixes = (prefixes = []) => ([...new Set(prefixes.map(normalizeNavigationPathPrefix).filter(Boolean))]);
export const matchesPathPrefix = (pathname, prefix) => (pathname === prefix
    || pathname.startsWith(normalizePathPrefix(prefix)));
export const matchesPathPattern = (pathname, pattern) => (typeof pattern === 'string'
    ? matchesPathPrefix(pathname, pattern)
    : pattern.test(pathname));
const getServiceRelativePathname = (servicePathname, requestPathname) => {
    const basePathname = servicePathname.replace(/\/+$/, '') || '/';
    if (basePathname === '/') {
        return requestPathname;
    }
    if (requestPathname === basePathname) {
        return '/';
    }
    return requestPathname.startsWith(`${basePathname}/`)
        ? requestPathname.slice(basePathname.length) || '/'
        : requestPathname;
};
const getPatternPathnames = (policy, requestPathname) => {
    const relativePathname = getServiceRelativePathname(policy.pathname, requestPathname);
    return relativePathname === requestPathname
        ? [requestPathname]
        : [requestPathname, relativePathname];
};
const matchesAnyPathnamePattern = (pathnames, pattern) => pathnames.some((pathname) => matchesPathPattern(pathname, pattern));
export const resolveOfflineDomainPolicies = (env) => (OFFLINE_DOMAINS.flatMap((definition) => {
    const serviceUrl = env[definition.envKey];
    if (!serviceUrl) {
        return [];
    }
    try {
        const { origin, pathname } = new URL(serviceUrl);
        return [{
                ...definition,
                origin,
                pathname,
                normalizedPathname: normalizePathPrefix(pathname),
            }];
    }
    catch {
        return [];
    }
}));
const matchesResolvedPolicy = (policy, url, method) => {
    if (method !== 'GET') {
        return false;
    }
    if (url.origin !== policy.origin) {
        return false;
    }
    if (!(url.pathname === policy.pathname || url.pathname.startsWith(policy.normalizedPathname))) {
        return false;
    }
    const patternPathnames = getPatternPathnames(policy, url.pathname);
    if (policy.includePathPatterns?.length) {
        return policy.includePathPatterns.some((pattern) => matchesAnyPathnamePattern(patternPathnames, pattern));
    }
    return !(policy.excludePathPatterns?.some((pattern) => matchesAnyPathnamePattern(patternPathnames, pattern)));
};
const serializePathPattern = (pattern) => (typeof pattern === 'string'
    ? {
        type: 'prefix',
        source: pattern,
        flags: '',
    }
    : {
        type: 'regex',
        source: pattern.source,
        flags: pattern.flags,
    });
export const matchOfflineDomainPolicy = (requestUrl, method, env) => {
    try {
        const url = new URL(requestUrl);
        return resolveOfflineDomainPolicies(env).find((policy) => matchesResolvedPolicy(policy, url, method)) ?? null;
    }
    catch {
        return null;
    }
};
const createUrlMatcher = (policy) => {
    const serializedPolicy = JSON.stringify({
        excludePathPatterns: policy.excludePathPatterns?.map(serializePathPattern) ?? [],
        includePathPatterns: policy.includePathPatterns?.map(serializePathPattern) ?? [],
        normalizedPathname: policy.normalizedPathname,
        origin: policy.origin,
        pathname: policy.pathname,
    });
    return new Function(`
    return ({ request, url }) => {
      const policy = ${serializedPolicy};
      const matchesPathPrefix = (pathname, prefix) => (
        pathname === prefix
        || pathname.startsWith(prefix.endsWith('/') ? prefix : \`\${prefix}/\`)
      );
      const matchesPathPattern = (pathname, pattern) => (
        pattern.type === 'prefix'
          ? matchesPathPrefix(pathname, pattern.source)
          : new RegExp(pattern.source, pattern.flags).test(pathname)
      );
      const getServiceRelativePathname = (servicePathname, requestPathname) => {
        const basePathname = servicePathname.replace(/\\/+$/, '') || '/';

        if (basePathname === '/') {
          return requestPathname;
        }

        if (requestPathname === basePathname) {
          return '/';
        }

        return requestPathname.startsWith(basePathname + '/')
          ? requestPathname.slice(basePathname.length) || '/'
          : requestPathname;
      };
      const getPatternPathnames = (pathname) => {
        const relativePathname = getServiceRelativePathname(policy.pathname, pathname);

        return relativePathname === pathname
          ? [pathname]
          : [pathname, relativePathname];
      };
      const matchesAnyPathnamePattern = (pathnames, pattern) => (
        pathnames.some((pathname) => matchesPathPattern(pathname, pattern))
      );

      if (request.method !== 'GET') {
        return false;
      }

      if (url.origin !== policy.origin) {
        return false;
      }

      if (!(url.pathname === policy.pathname || url.pathname.startsWith(policy.normalizedPathname))) {
        return false;
      }

      const patternPathnames = getPatternPathnames(url.pathname);

      if (policy.includePathPatterns.length) {
        return policy.includePathPatterns.some((pattern) => matchesAnyPathnamePattern(patternPathnames, pattern));
      }

      return !policy.excludePathPatterns.some((pattern) => matchesAnyPathnamePattern(patternPathnames, pattern));
    };
  `)();
};
// Evicts any cached entry for a request when the network responds with a
// non-2xx status. Without this, a stale 200 left over from an earlier
// successful fetch can keep serving even after the resource has moved or
// been deleted (e.g. /auth/files/{id} returning 404 after the row is gone).
// Pair with `cacheableResponse: { statuses: [200] }` so the same response
// is never re-added to cache on the same request.
const createEvictStalePlugin = (cacheName) => {
    const serializedCacheName = JSON.stringify(cacheName);
    return new Function(`
    return {
      fetchDidSucceed: async ({ request, response }) => {
        const cacheName = ${serializedCacheName};

        if (!response.ok && typeof caches !== 'undefined') {
          try {
            const cache = await caches.open(cacheName);
            await cache.delete(request);
          } catch {
            // best-effort cleanup; never let cache errors break the response path
          }
        }

        return response;
      },
    };
  `)();
};
const createNetworkFirstRule = (policy) => ({
    urlPattern: createUrlMatcher(policy),
    handler: 'NetworkFirst',
    options: {
        cacheName: policy.cacheName,
        expiration: {
            maxEntries: policy.maxEntries ?? 100,
            maxAgeSeconds: policy.maxAgeSeconds ?? 7 * 24 * 60 * 60,
        },
        cacheableResponse: {
            statuses: [200],
        },
        networkTimeoutSeconds: policy.networkTimeoutSeconds ?? 5,
        plugins: [
            createEvictStalePlugin(policy.cacheName),
        ],
    },
});
const createNavigationMatcher = (excludedPathPrefixes) => {
    const serializedExcludedPathPrefixes = JSON.stringify(excludedPathPrefixes);
    return new Function(`
    return ({ request, url }) => {
      const excludedPathPrefixes = ${serializedExcludedPathPrefixes};
      const matchesPathPrefix = (pathname, prefix) => (
        prefix === '/'
        || pathname === prefix
        || pathname.startsWith(prefix.endsWith('/') ? prefix : \`\${prefix}/\`)
      );

      return (
        request.mode === 'navigate'
        && request.method === 'GET'
        && url.origin === self.location.origin
        && !excludedPathPrefixes.some((prefix) => matchesPathPrefix(url.pathname, prefix))
      );
    };
  `)();
};
const createNavigationFallbackPlugin = (excludedPathPrefixes) => {
    const shouldIncludeDashboardShellFallback = !excludedPathPrefixes.some((prefix) => (matchesPathPrefix('/dashboard', prefix)));
    const fallbackCandidateSelection = shouldIncludeDashboardShellFallback
        ? `
        if (requestPathname === '/dashboard' || requestPathname.startsWith('/dashboard/')) {
          fallbackCandidates = ['/dashboard/index.html', '/dashboard.html', '/index.html', '/offline.html'];
        } else if (shouldTryStaticRouteCandidates(requestPathname)) {
          fallbackCandidates = [...createStaticRouteCandidates(requestPathname), '/index.html', '/offline.html'];
        } else {
          fallbackCandidates = ['/offline.html'];
        }
      `
        : `
        if (shouldTryStaticRouteCandidates(requestPathname)) {
          fallbackCandidates = [...createStaticRouteCandidates(requestPathname), '/index.html', '/offline.html'];
        } else {
          fallbackCandidates = ['/offline.html'];
        }
      `;
    return new Function(`
    return {
      handlerDidError: async ({ request }) => {
        const shouldTryStaticRouteCandidates = (pathname) => {
          if (!pathname || pathname === '/' || pathname === '/offline.html') {
            return false;
          }

          const segments = pathname.split('/').filter(Boolean);
          if (!segments.length) {
            return false;
          }

          if (segments.some((segment) => segment.includes('.'))) {
            return false;
          }

          return pathname !== '/dashboard' && !pathname.startsWith('/dashboard/');
        };
        const createStaticRouteCandidates = (pathname) => {
          const candidates = new Set();
          const normalizedPath = pathname === '/' ? '/index.html' : pathname.replace(/\\/+$/, '') || '/';

          candidates.add(pathname);
          candidates.add(normalizedPath);

          if (normalizedPath !== '/' && !normalizedPath.endsWith('.html')) {
            candidates.add(\`\${normalizedPath}.html\`);
            candidates.add(\`\${normalizedPath}/index.html\`);
          }

          return [...candidates];
        };

        const requestPathname = request?.url ? new URL(request.url).pathname : '';
        let fallbackCandidates;
        ${fallbackCandidateSelection}

        for (const fallbackPath of fallbackCandidates) {
          const cachedResponse = await caches.match(fallbackPath, { ignoreSearch: true });
          if (cachedResponse) {
            return cachedResponse;
          }
        }

        return Response.error();
      },
    };
  `)();
};
const createNavigationRule = (policy, options) => {
    const excludedPathPrefixes = normalizeNavigationPathPrefixes(options.excludeNavigationPathPrefixes);
    return {
        urlPattern: createNavigationMatcher(excludedPathPrefixes),
        handler: 'NetworkFirst',
        options: {
            cacheName: policy.cacheName,
            expiration: {
                maxEntries: policy.maxEntries ?? 200,
                maxAgeSeconds: policy.maxAgeSeconds ?? 30 * 24 * 60 * 60,
            },
            cacheableResponse: {
                statuses: [200],
            },
            networkTimeoutSeconds: policy.networkTimeoutSeconds ?? 3,
            plugins: [
                createNavigationFallbackPlugin(excludedPathPrefixes),
                createEvictStalePlugin(policy.cacheName),
            ],
        },
    };
};
export const buildWorkboxRuntimeCaching = (env, options = {}) => (
// CacheStorage matches by Request URL and cannot safely partition a private
// response by authenticated session/profile. Private API fallback is owned
// exclusively by the partitioned IndexedDB adapter.
resolveOfflineDomainPolicies(env).filter(policy => policy.scope === 'public').map((policy) => (policy.strategy === 'navigation'
    ? createNavigationRule(policy, options)
    : createNetworkFirstRule(policy))));
