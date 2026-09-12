import type { ISession } from '@webdevelop-pro/domain-types/authTypes';
import { APIError } from '@webdevelop-pro/invest-data/service/handlers/apiError';

const OFFLINE_ERROR_MESSAGES = [
  'failed to fetch',
  'load failed',
  'network request failed',
  'networkerror when attempting to fetch resource',
] as const;

export const isBrowserOffline = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

export const hasActiveLocalSession = (session?: ISession | null) => Boolean(session?.active);

export const shouldPreserveOfflineSession = (
  session?: ISession | null,
  error?: unknown,
) => {
  if (!hasActiveLocalSession(session)) {
    return false;
  }

  if (isBrowserOffline()) {
    return true;
  }

  if (error instanceof APIError || !(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  return OFFLINE_ERROR_MESSAGES.some((candidate) => errorMessage.includes(candidate));
};
