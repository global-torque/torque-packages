import type { AnalyticsLogCreate } from '@global-torque/sdk/resources/analytics';
import type { InvestApplicationContext } from '../applicationContext.ts';
import type { RuntimeAnalyticsAdapter } from '../adapters.ts';
import type { IAnalyticsEventRequest } from '@global-torque/domain-types/analyticsTypes';

/** Create the runtime analytics adapter backed by an application-owned SDK context. */
export const createSdkAnalyticsAdapter = (
  context: InvestApplicationContext,
): RuntimeAnalyticsAdapter => {
  const analyticsResource = context.createAnalyticsSdkResource();

  return {
    trackEvent: async (event: IAnalyticsEventRequest): Promise<void> => {
      await analyticsResource.createEvent({ body: event });
    },
    logMessage: async (message: Record<string, unknown>): Promise<void> => {
      await analyticsResource.createLog({
        body: {
          ...message,
          time: (message.time as string | undefined) || new Date().toISOString(),
        } as AnalyticsLogCreate,
      });
    },
  };
};
