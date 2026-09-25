import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createAnalyticsResource } from '@global-torque/sdk/resources/analytics';
import type { SdkServiceClient } from '@global-torque/sdk';
import type { InvestAppConfig } from '@global-torque/invest-core/app/config';
import { useSessionStore } from '../../session/store/useSession.ts';
import {
  configureInvestRuntimeAdapters,
  resetInvestRuntimeAdaptersForTests,
} from '../../adapters.ts';
import {
  resetInvestRuntimeConfigForTests,
  setInvestRuntimeConfig,
} from '../../config.ts';
import {
  resetReportedErrorAnalyticsDedupeForTests,
  sendReportedErrorToAnalytics,
} from '../sendReportedErrorToAnalytics.ts';
import { useSendAnalyticsEvent } from '../useSendAnalyticsEvent.ts';

const config = (): InvestAppConfig => ({
  env: 'test',
  isDev: true,
  enableAnalytics: true,
  urls: {
    frontend: 'https://app.example.test',
    dashboard: 'https://dashboard.example.test',
    static: 'https://static.example.test',
    api: {
      user: 'https://user.example.test',
      offer: 'https://offer.example.test',
      investment: 'https://investment.example.test',
      wallet: 'https://wallet.example.test',
      evm: 'https://evm.example.test',
      filer: 'https://filer.example.test',
      distributions: 'https://distributions.example.test',
      accreditation: 'https://accreditation.example.test',
      kratos: 'https://kratos.example.test',
    },
  },
  brand: { title: 'Torque', description: 'Test' },
  thirdParty: {},
});

describe('runtime analytics sanitization', () => {
  const trackEvent = vi.fn().mockResolvedValue(undefined);
  const logMessage = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    setActivePinia(createPinia());
    setInvestRuntimeConfig(config());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    resetInvestRuntimeAdaptersForTests();
    configureInvestRuntimeAdapters({ analytics: { trackEvent, logMessage } });
    trackEvent.mockClear();
    logMessage.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetReportedErrorAnalyticsDedupeForTests();
    resetInvestRuntimeAdaptersForTests();
    resetInvestRuntimeConfigForTests();
  });

  it('preserves user identity and business event data while masking credentials', async () => {
    useSessionStore().$patch({
      userSession: {
        identity: { id: 'identity-123', traits: { email: 'user@example.com' } },
      },
    });
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://app.example.test/from?email=user@example.com&%74oken=REFERRER_SECRET#activity',
    });

    await useSendAnalyticsEvent({ serviceName: 'dashboard' }).sendEvent({
      event_type: 'click',
      httpRequestMethod: 'GET',
      request_path: '/offers?email=user@example.com&token=EVENT_SECRET',
      httpRequestUrl: 'https://api.example.test/offers?email=user@example.com&token=EVENT_SECRET',
      body: {
        email: 'user@example.com',
        identity_id: 'identity-123',
        longId: '12345678901234567890',
        token_symbol: 'USDC',
        redirect_url: '/auth?%74oken=REDIRECT_SECRET&email=user@example.com',
        password: 'PASSWORD_SECRET',
        nested: { access_token: 'TOKEN_SECRET' },
      },
    });

    const event = trackEvent.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      identity_id: 'identity-123',
      service_context: { user: 'user@example.com' },
      body: {
        email: 'user@example.com',
        identity_id: 'identity-123',
        longId: '12345678901234567890',
        token_symbol: 'USDC',
        redirect_url: '/auth?token=%5Bredacted%5D&email=user%40example.com',
        password: '[redacted]',
        nested: { access_token: '[redacted]' },
      },
    });
    expect(event.service_context.httpRequest.url).toContain('email=user%40example.com');
    expect(event.service_context.httpRequest.url).toContain('token=%5Bredacted%5D');
    expect(event.service_context.httpRequest.referer).toContain('email=user%40example.com');
    expect(event.service_context.httpRequest.referer).toContain('token=%5Bredacted%5D');
    expect(event.service_context.httpRequest.referer).toContain('#activity');
    expect(JSON.stringify(event)).not.toContain('EVENT_SECRET');
  });

  it('redacts regulated identity and payment fields through the runtime hook', async () => {
    await useSendAnalyticsEvent({ serviceName: 'dashboard' }).sendEvent({
      event_type: 'send',
      method: 'POST',
      httpRequestMethod: 'POST',
      httpRequestUrl: '/self-service/settings/browser',
      body: {
        ssn: '111-22-3333',
        tax_id: 'tax-secret',
        bank_account_number: 'bank-secret',
        card_number: '4111111111111111',
        cvv: '123',
        iban: 'DE89370400440532013000',
        payment_token: 'payment-token-secret',
        account: 'business-account',
        token_symbol: 'USDC',
      },
    });

    const event = trackEvent.mock.calls[0]?.[0];
    expect(event.body).toEqual({
      ssn: '[redacted]',
      tax_id: '[redacted]',
      bank_account_number: '[redacted]',
      card_number: '[redacted]',
      cvv: '[redacted]',
      iban: '[redacted]',
      payment_token: '[redacted]',
      account: 'business-account',
      token_symbol: 'USDC',
    });
    expect(JSON.stringify(event)).not.toContain('111-22-3333');
    expect(JSON.stringify(event)).not.toContain('payment-token-secret');
  });

  it('keeps final error text, stack, body, and URL context outside the internal envelope sanitizer', async () => {
    const reportOptions = {
      serviceName: 'dashboard',
      body: {
        email: 'user@example.com',
        offer_id: 42,
        password: 'PASSWORD_SECRET',
      },
      caller: ['OfferView user@example.com'],
      stack: ['Error: user@example.com', 'at https://api.example.test/offers?email=user@example.com&%74oken=STACK_SECRET'],
      httpRequest: {
        method: 'GET',
        url: 'https://api.example.test/offers?email=user@example.com&%74oken=URL_SECRET',
      },
    };
    sendReportedErrorToAnalytics(
      { message: 'Could not load /offers?%74oken=LOG_SECRET&email=user@example.com offer', code: 'E_OFFER', statusCode: 500 },
      'Offer failed for user@example.com',
      reportOptions,
    );

    sendReportedErrorToAnalytics(
      { message: 'Could not load /offers?%74oken=LOG_SECRET&email=user@example.com offer', code: 'E_OFFER', statusCode: 500 },
      'Offer failed for user@example.com',
      reportOptions,
    );

    await vi.waitFor(() => expect(logMessage).toHaveBeenCalledTimes(1));
    const payload = logMessage.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      error: 'Offer failed for user@example.com: Could not load /offers?token=%5Bredacted%5D&email=user%40example.com offer',
      body: {
        email: 'user@example.com',
        offer_id: 42,
        password: '[redacted]',
      },
      data: {
        caller: ['OfferView user@example.com'],
        stack: [
          'Error: user@example.com',
          'at https://api.example.test/offers?email=user%40example.com&token=%5Bredacted%5D',
        ],
      },
    });
    expect(JSON.stringify(payload)).not.toContain('PASSWORD_SECRET');
    expect(JSON.stringify(payload)).not.toContain('URL_SECRET');
  });

  it('keeps request_path within the installed SDK contract while retaining full URL context', async () => {
    useSessionStore().$patch({
      userSession: {
        identity: { id: 'identity-123', traits: { email: 'user@example.com' } },
      },
    });
    const requests: unknown[] = [];
    const post = vi.fn().mockImplementation(async (_path: string, body: unknown) => {
      requests.push(body);
      return { data: { id: 'event-1' }, status: 201, headers: new Headers() };
    });
    const resource = createAnalyticsResource({ post } as unknown as SdkServiceClient);
    configureInvestRuntimeAdapters({
      analytics: {
        trackEvent: (event) => resource.createEvent({ body: event }).then(() => undefined),
        logMessage,
      },
    });
    const longFilter = 'business-filter-'.repeat(24);

    await useSendAnalyticsEvent({ serviceName: 'dashboard' }).sendEvent({
      event_type: 'open',
      httpRequestMethod: 'GET',
      request_path: `/offers?filter=${longFilter}&token=PATH_SECRET`,
      httpRequestUrl: `https://api.example.test/offers?filter=${longFilter}&token=URL_SECRET`,
    });

    const event = requests[0] as {
      request_path: string;
      service_context: { httpRequest: { url: string } };
    };
    expect(post).toHaveBeenCalledWith('/public/event', expect.anything(), expect.anything());
    expect(event.request_path.length).toBeLessThanOrEqual(255);
    expect(event.request_path).toContain('/offers?filter=');
    expect(event.service_context.httpRequest.url.length).toBeGreaterThan(255);
    expect(event.service_context.httpRequest.url).toContain('filter=');
    expect(event.service_context.httpRequest.url).toContain('token=%5Bredacted%5D');
  });
});
