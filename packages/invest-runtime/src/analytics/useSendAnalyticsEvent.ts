
import { storeToRefs } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { useSessionStore } from '../session/store/useSession.ts';
import type {
  AnalyticsEventType,
  AnalyticsHttpMethod,
  IAnalyticsEventRequest,
} from '@global-torque/domain-types/analyticsTypes';
import {
  normalizeAnalyticsBodyForMethod,
  sanitizeAnalyticsText,
} from '@global-torque/invest-core/analytics/analyticsBody';
import {
  getInvestRuntimeClientServiceName,
  getInvestRuntimeConfig,
  isInvestRuntimeFlagEnabled,
} from '../config.ts';
import { getInvestRuntimeAdapters } from '../adapters.ts';
import { buildHttpRequest } from './useAnalyticsError.ts';

const sanitizeRequestPath = (raw: unknown): string => {
  const value = sanitizeAnalyticsText(raw).trim();
  if (!value) return '';

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://client.local';
    return new URL(value, base).pathname;
  } catch {
    return value.split('?')[0]?.split('#')[0] ?? '';
  }
};

export interface UseSendAnalyticsEventOptions {
  /**
   * Logical name of the frontend application emitting events.
   * Example: 'dashboard', 'invest', 'tahoe'.
   */
  serviceName: string;
}

export interface SendEventOptions {
  event_type: AnalyticsEventType;
  method?: AnalyticsHttpMethod;
  httpRequestMethod?: AnalyticsHttpMethod;
  status_code?: number;
  /**
   * Where the user is in the app (UI route or logical location).
   * Example: '/onboarding/kyc'
   */
  request_path?: string;
  /**
   * What API endpoint was called.
   * Example: 'https://api.x.com/v1/kyc/submit'
   */
  httpRequestUrl?: string;
  /**
   * Optional correlation id; defaults to a UUID when omitted.
   */
  request_id?: string;
  /**
   * Override service name; normally rely on resolvedServiceName instead.
   */
  service_name?: string;
  version?: string;
  body?: unknown;
}

export const useSendAnalyticsEvent = (options?: UseSendAnalyticsEventOptions) => {
  const userSessionStore = useSessionStore();
  const { userSession, userSessionTraits } = storeToRefs(userSessionStore);

  const resolvedServiceName = options?.serviceName
    ?? getInvestRuntimeClientServiceName();

  const sendEvent = async (eventOptions: SendEventOptions): Promise<void> => {
    if (!isInvestRuntimeFlagEnabled('ENABLE_ANALYTICS')) {
      return;
    }

    const analytics = getInvestRuntimeAdapters().analytics;

    if (!analytics) {
      return;
    }

    const identityId = (userSession?.value?.identity?.id || '');
    const userEmail = sanitizeAnalyticsText(userSessionTraits?.value?.email || '');
    const requestId = eventOptions.request_id || uuidv4();
    const requestPath = sanitizeRequestPath(eventOptions.request_path);

    const httpLike = buildHttpRequest({
      method: eventOptions.httpRequestMethod || 'POST',
      // Prefer explicit API URL if provided; otherwise fall back to browser URL
      url: eventOptions.httpRequestUrl || undefined,
    });
    const requestMethod =
      (httpLike.method as AnalyticsHttpMethod) || (eventOptions.httpRequestMethod || 'POST');

    const serviceName = eventOptions.service_name || resolvedServiceName;

    if (!serviceName) {
      return;
    }

    const eventData: IAnalyticsEventRequest = {
      event_type: eventOptions.event_type,
      method: eventOptions.method || 'GET',
      status_code: eventOptions.status_code || 200,
      identity_id: identityId,
      request_path: requestPath,
      body: normalizeAnalyticsBodyForMethod(requestMethod, eventOptions.body),
      service_context: {
        httpRequest: {
          method: requestMethod,
          url: httpLike.url,
          userAgent: httpLike.userAgent,
          referer: httpLike.referer,
          remoteIp: httpLike.remoteIp,
          protocol: httpLike.protocol,
        },
        user: userEmail,
        request_id: requestId,
        service_name: serviceName,
        version: eventOptions.version || getInvestRuntimeConfig().build?.version || 'unknown',
      },
    };

    try {
      await analytics.trackEvent(eventData);
    } catch (error) {
      console.error('Failed to send analytics event', error);
      // Don't throw - analytics failures shouldn't break the app
    }
  };

  return {
    sendEvent,
  };
};
