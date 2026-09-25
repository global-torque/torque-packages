import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAnalyticsEventRequest } from '@global-torque/domain-types/analyticsTypes';
import type { InvestApplicationContext } from '../../applicationContext.ts';
import { createSdkAnalyticsAdapter } from '../index.ts';

describe('createSdkAnalyticsAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards events to the context-owned SDK analytics resource', async () => {
    const event: IAnalyticsEventRequest = {
      event_type: 'send',
      method: 'POST',
      status_code: 201,
      identity_id: 'identity-1',
      request_path: '/investments',
      body: { amount: '100' },
      service_context: {
        httpRequest: {
          method: 'POST',
          url: '/investments',
          userAgent: '',
          referer: '',
          remoteIp: '',
          protocol: 'https',
        },
        user: 'identity-1',
        request_id: '',
        service_name: 'invest',
        version: '',
      },
    };
    const createEvent = vi.fn().mockResolvedValue(undefined);
    const createLog = vi.fn().mockResolvedValue(undefined);
    const createAnalyticsSdkResource = vi.fn(() => ({ createEvent, createLog }));
    const context = { createAnalyticsSdkResource } as unknown as InvestApplicationContext;

    await createSdkAnalyticsAdapter(context).trackEvent(event);

    expect(createAnalyticsSdkResource).toHaveBeenCalledOnce();
    expect(createEvent).toHaveBeenCalledWith({ body: event });
  });

  it('forwards log messages and preserves an explicit timestamp', async () => {
    const createEvent = vi.fn().mockResolvedValue(undefined);
    const createLog = vi.fn().mockResolvedValue(undefined);
    const context = {
      createAnalyticsSdkResource: vi.fn(() => ({ createEvent, createLog })),
    } as unknown as InvestApplicationContext;
    const message = {
      message: 'Analytics failure',
      time: '2026-09-25T10:00:00.000Z',
      body: { operation: 'load' },
    };

    await createSdkAnalyticsAdapter(context).logMessage(message);

    expect(createLog).toHaveBeenCalledWith({ body: message });
  });

  it('supplies an ISO timestamp when a log message has no timestamp', async () => {
    const createEvent = vi.fn().mockResolvedValue(undefined);
    const createLog = vi.fn().mockResolvedValue(undefined);
    const context = {
      createAnalyticsSdkResource: vi.fn(() => ({ createEvent, createLog })),
    } as unknown as InvestApplicationContext;
    const now = '2026-09-25T12:34:56.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    await createSdkAnalyticsAdapter(context).logMessage({ message: 'Analytics failure' });

    expect(createLog).toHaveBeenCalledWith({
      body: { message: 'Analytics failure', time: now },
    });
  });
});
