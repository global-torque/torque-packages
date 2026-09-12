import { describe, expect, it } from 'vitest';
import {
  SdkNetworkError,
  SdkResponseValidationError,
  SdkValidationError,
} from '@global-torque/sdk';
import {
  executeSdkReadWithCompatibilityErrors,
  resolveCompatibilityServiceRequestUrl,
  validateOfferDetailCompatibilityResponse,
  validateOfferListCompatibilityEnvelope,
  validateOfferListCompatibilityResponse,
} from '../migration/sdkReadCompatibility.ts';
import { APIError } from '../service/handlers/apiError.ts';
import { NetworkRequestError } from '../service/handlers/networkRequestError.ts';

describe('SDK read compatibility projection', () => {
  it('normalizes deployed offer decimal strings and preserves the pinned list contract', () => {
    const result = validateOfferListCompatibilityResponse({
      count: 1,
      data: [
        {
          id: 7,
          slug: 'deployed-offer',
          created_at: '2026-07-01',
          price_per_share: '100.00',
          min_investment: '10.00',
        },
      ],
    });

    expect(result.data?.[0]).toMatchObject({
      price_per_share: '100',
      min_investment: '10',
    });
    expect((result.data?.[0] as Record<string, unknown>).created_at).toBe('2026-07-01');
  });

  it.each([
    { count: 'invalid', data: [] },
    { count: 1, data: 'invalid' },
  ])('rejects malformed compatibility offer envelopes %#', (payload) => {
    expect(() => validateOfferListCompatibilityResponse(payload)).toThrow(
      'OfferListResponse response does not satisfy its compatible contract.',
    );
  });

  it('validates list metadata without rejecting an individual malformed offer', () => {
    const malformedOffer = { id: 'invalid', slug: 'bad-offer' };

    expect(validateOfferListCompatibilityEnvelope({
      count: 1,
      data: [malformedOffer],
    })).toEqual({
      count: 1,
      data: [malformedOffer],
    });
  });

  it('still rejects malformed list metadata during envelope validation', () => {
    expect(() => validateOfferListCompatibilityEnvelope({
      count: 'invalid',
      data: [],
    })).toThrow('OfferListResponse response does not satisfy its compatible contract.');
  });

  it('preserves additive compatibility offer fields', () => {
    expect(
      validateOfferListCompatibilityResponse({
        count: 0,
        data: [],
        unexpected: true,
      }),
    ).toMatchObject({ unexpected: true });
  });

  it('normalizes deployed offer detail decimal strings and revalidates it', () => {
    const result = validateOfferDetailCompatibilityResponse({
      id: 7,
      slug: 'deployed-offer',
      price_per_share: '100.00',
      min_investment: '10.00',
    });

    expect(result).toMatchObject({
      price_per_share: '100',
      min_investment: '10',
    });
  });

  it('preserves open-ended close_at while excluding it from compatibility validation', () => {
    const result = validateOfferListCompatibilityResponse({
      count: 1,
      data: [
        {
          id: 7,
          slug: 'open-ended-offer',
          fund_structure: 'open_ended',
          close_at: '0001-01-01T00:00:00',
        },
      ],
    });

    expect(result.data?.[0]?.close_at).toBe('0001-01-01T00:00:00');
  });

  it('preserves open-ended close_at details without validating the date format', () => {
    const result = validateOfferDetailCompatibilityResponse({
      id: 7,
      slug: 'open-ended-offer',
      fund_structure: 'open_ended',
      close_at: '0001-01-01T00:00:00',
    });

    expect(result.close_at).toBe('0001-01-01T00:00:00');
  });

  it('temporarily excludes close_at validation for every deployed offer', () => {
    const result = validateOfferDetailCompatibilityResponse({
      id: 7,
      slug: 'closed-ended-offer',
      fund_structure: 'closed_ended',
      close_at: '0001-01-01T00:00:00',
    });

    expect(result.close_at).toBe('0001-01-01T00:00:00');
  });

  it('preserves exact decimal precision while removing trailing zeroes', () => {
    const result = validateOfferDetailCompatibilityResponse({
      id: 7,
      slug: 'deployed-offer',
      price_per_share: '99999999999999999999.123456789012345600',
      min_investment: '0.100000000000000000',
    });

    expect(result).toMatchObject({
      price_per_share: '99999999999999999999.1234567890123456',
      min_investment: '0.1',
    });
  });

  it('rejects malformed compatibility offer details', () => {
    expect(() =>
      validateOfferDetailCompatibilityResponse({
        id: 'invalid',
        price_per_share: '100.00',
        min_investment: '10.00',
      }),
    ).toThrow('OfferDetailResponse response does not satisfy its compatible contract.');
  });

  it('resolves resource paths under a versioned service base URL', () => {
    expect(
      resolveCompatibilityServiceRequestUrl('https://api.example.test/v1.0', '/public/offer'),
    ).toBe('https://api.example.test/v1.0/public/offer');
  });

  it('preserves APIError identity and the bounded protocol response body', async () => {
    const error = new SdkValidationError(new Headers({ 'content-type': 'application/json' }), {
      status: 422,
      responseBody: { message: 'Invalid filter' },
      bodyKind: 'json',
      attempts: 1,
    });

    const projected = await executeSdkReadWithCompatibilityErrors({
      execute: async () => {
        throw error;
      },
      method: 'GET',
      requestUrl: 'https://api.example.test/v1.0/offers?token=secret',
    }).catch((reason: unknown) => reason);

    expect(projected).toBeInstanceOf(APIError);
    expect(projected).toMatchObject({
      message: 'Invalid filter',
      data: {
        statusCode: 422,
        httpRequest: {
          method: 'GET',
          url: 'https://api.example.test/v1.0/offers',
        },
      },
    });
  });

  it('preserves NetworkRequestError identity and retry attempts', async () => {
    const projected = await executeSdkReadWithCompatibilityErrors({
      execute: async () => {
        throw new SdkNetworkError({ attempts: 2 });
      },
      method: 'GET',
      requestUrl: 'https://api.example.test/v1.0/offers',
    }).catch((reason: unknown) => reason);

    expect(projected).toBeInstanceOf(NetworkRequestError);
    expect(projected).toMatchObject({
      data: {
        attempts: 2,
        retryable: true,
      },
    });
  });

  it('keeps response-validation failures SDK-native', async () => {
    const validationError = new SdkResponseValidationError({
      route: 'OfferList',
    });

    await expect(
      executeSdkReadWithCompatibilityErrors({
        execute: async () => {
          throw validationError;
        },
        method: 'GET',
        requestUrl: 'https://api.example.test/v1.0/public/offer',
      }),
    ).rejects.toBe(validationError);
  });
});
