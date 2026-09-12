import type {
  RouteLocationRaw,
  Router,
} from 'vue-router';

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

export const isBrowserNavigationTarget = (target: RouteLocationRaw): target is string => {
  if (typeof target !== 'string' || !ABSOLUTE_URL_PATTERN.test(target)) {
    return false;
  }

  try {
    return ['http:', 'https:'].includes(new URL(target).protocol);
  } catch {
    return false;
  }
};

export const getCurrentBrowserHref = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.href;
};

export const resolveCurrentRedirectTarget = (routeFullPath?: string | null): string | undefined => {
  const normalizedRoutePath = typeof routeFullPath === 'string' ? routeFullPath.trim() : '';

  if (normalizedRoutePath) {
    return normalizedRoutePath;
  }

  return getCurrentBrowserHref();
};

export const navigateToRouteLocation = async (
  router: Pick<Router, 'push'>,
  target: RouteLocationRaw,
) => {
  if (typeof target === 'string' && (ABSOLUTE_URL_PATTERN.test(target) || target.startsWith('//'))) {
    if (isBrowserNavigationTarget(target) && typeof window !== 'undefined') {
      window.location.assign(target);
    }
    return;
  }

  await router.push(target);
};
