import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { IOffer } from '@global-torque/domain-types/offerTypes';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiOptionsMock = vi.hoisted(() => vi.fn());

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    dataClientConfig: {
      apiUrls: { offer: 'https://offer.example.test/' },
    },
    createApiClient: () => ({
      get: apiGetMock,
      post: apiPostMock,
      options: apiOptionsMock,
    }),
    createOffersSdkResource: () => ({
      listOffers: apiGetMock,
      getOffer: apiGetMock,
    }),
  }),
}));

vi.mock('@global-torque/invest-data/service/apiClient', () => ({
  ApiClient: class {
    get = apiGetMock;
  },
}));

import { useRepositoryOffer } from '../offer.repository.ts';

const createOffer = (overrides: Partial<IOffer> = {}): IOffer => ({
  id: 7,
  name: 'Springfield Bond',
  legal_name: 'Springfield Bond LLC',
  slug: 'springfield-bond',
  title: 'Springfield Bond',
  security_type: 'debt',
  price_per_share: '100',
  min_investment: '10',
  image_link_id: 20,
  total_shares: '1000',
  valuation: 500000,
  subscribed_shares: '250',
  confirmed_shares: '200',
  status: 'published',
  approved_at: '2026-03-01T00:00:00.000Z',
  website: 'https://springfield.example',
  state: 'IL',
  city: 'Springfield',
  security_info: {
    voting_rights: '',
    liquidation_preference: '',
    dividend_type: '',
    dividend_rate: '',
    dividend_payment_frequency: '',
    cn_valuation_cap: '',
    cn_discount_rate: '',
    cn_interest_rate: '',
    cn_maturity_date: '',
    interest_rate_apy: '',
    debt_payment_schedule: 'interest_only_monthly',
    debt_maturity_date: '2027-03-01T00:00:00.000Z',
    debt_interest_rate: '8',
    debt_term_length: '12',
    debt_term_unit: 'months',
    pre_money_valuation: 0,
  },
  close_at: '2026-12-31T00:00:00.000Z',
  seo_title: 'Springfield Bond Offer',
  seo_description: 'List card description',
  description: '',
  highlights: '',
  risk_disclosures: '',
  additional_details: '',
  data: {
    wire_to: '',
    swift_id: '',
    custodian: '',
    account_number: '',
    routing_number: '',
    apy: '',
    distribution_frequency: '',
    investment_strategy: '',
    estimated_hold_period: '',
    video: '',
  },
  linkedin: '',
  facebook: '',
  twitter: '',
  github: '',
  instagram: '',
  telegram: '',
  mastodon: '',
  reg_type: 'Reg D 506(c)',
  amount_raised: 25000,
  target_raise: 100000,
  ...overrides,
});

describe('useRepositoryOffer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiOptionsMock.mockReset();
  });

  it('replaces cached list data when detail fields arrive for the same offer id', async () => {
    const listOffer = createOffer();
    const detailOffer = createOffer({
      description: 'Full description from the detail endpoint',
      highlights: 'Detail highlights',
      risk_disclosures: 'Detail risk disclosures',
    });

    apiGetMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          data: [listOffer],
        },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: detailOffer,
        headers: new Headers(),
      });

    const store = useRepositoryOffer();

    await store.getOffers();
    await store.getOfferOne(detailOffer.slug);

    expect(store.getOfferOneState.data?.description).toBe(
      'Full description from the detail endpoint',
    );
    expect(store.getOfferOneState.data?.highlights).toBe('Detail highlights');
    expect(store.getOfferOneState.data?.risk_disclosures).toBe(
      'Detail risk disclosures',
    );
  });

  it('preserves canonical SDK network provenance for live offer verification', async () => {
    const detailOffer = createOffer();
    apiGetMock.mockResolvedValueOnce({
      data: detailOffer,
      headers: new Headers(),
      metadata: { source: 'network' },
    });

    const store = useRepositoryOffer();
    await store.getOfferOne(detailOffer.slug);

    expect(store.getOfferOneState.dataSource).toBe('network');
  });

  it('preserves canonical SDK offline provenance for fail-closed offer controls', async () => {
    const detailOffer = createOffer();
    apiGetMock.mockResolvedValueOnce({
      data: detailOffer,
      headers: new Headers(),
      metadata: { source: 'offline-cache' },
    });

    const store = useRepositoryOffer();
    await store.getOfferOne(detailOffer.slug);

    expect(store.getOfferOneState.dataSource).toBe('offline-cache');
  });

  it.each([undefined, { source: 'unknown' }])(
    'keeps absent or unknown SDK provenance fail closed',
    async (metadata) => {
      const detailOffer = createOffer();
      apiGetMock.mockResolvedValueOnce({
        data: detailOffer,
        headers: new Headers(),
        ...(metadata ? { metadata } : {}),
      });

      const store = useRepositoryOffer();
      await store.getOfferOne(detailOffer.slug);

      expect(store.getOfferOneState.dataSource).toBeUndefined();
    },
  );

  it('replaces cached list data when detail on-chain summary arrives for the same offer id', async () => {
    const listOffer = createOffer();
    const detailOffer = createOffer({
      on_chain_summary: {
        network: 'Ethereum Sepolia',
        asset_token: {
          standard: 'ERC-20',
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0x1111111111111111111111111111111111111111',
        },
        vault: {
          standard: 'ERC-7540',
          address: '0x2222222222222222222222222222222222222222',
        },
      },
    });

    apiGetMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          data: [listOffer],
        },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: detailOffer,
        headers: new Headers(),
      });

    const store = useRepositoryOffer();

    await store.getOffers();
    await store.getOfferOne(detailOffer.slug);

    expect(store.getOfferOneState.data?.on_chain_summary).toEqual(
      detailOffer.on_chain_summary,
    );
  });

  it('invalidates cached offers when fund structure changes', async () => {
    apiGetMock
      .mockResolvedValueOnce({
        data: createOffer({ fund_structure: 'open_ended', total_shares: '0' }),
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: createOffer({ fund_structure: 'closed_ended', total_shares: '0' }),
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOfferOne('springfield-bond');

    await expect(store.getOfferOne('springfield-bond'))
      .rejects.toThrow('total_shares must be greater than zero');
  });

  it('keeps open-ended offers investable after their informational total is exceeded', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        count: 1,
        data: [createOffer({
          fund_structure: 'open_ended',
          total_shares: '1000',
          subscribed_shares: '1001',
          confirmed_shares: '1001',
        })],
      },
      headers: new Headers(),
    });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(store.getTopOpenOffer()).toEqual(expect.objectContaining({
      id: 7,
      isFullyFunded: false,
      isSharesReached: false,
    }));
  });

  it('logs and skips a malformed offer without dropping later valid offers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    apiGetMock.mockResolvedValueOnce({
      data: {
        count: 3,
        data: [
          createOffer({ id: 1, slug: 'offer-1' }),
          createOffer({
            id: 2,
            slug: 'offer-2',
            subscribed_shares: '10',
            confirmed_shares: '11',
          }),
          createOffer({ id: 3, slug: 'offer-3' }),
        ],
      },
      headers: new Headers(),
    });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(store.getOffersState.data?.data.map((offer) => offer.id)).toEqual([1, 3]);
    expect(store.getOffersState.data?.count).toBe(2);
    expect(consoleError).toHaveBeenCalledWith(
      'Skipping invalid offer 2',
      expect.objectContaining({
        message: 'confirmed_shares must not exceed subscribed_shares',
      }),
    );
    consoleError.mockRestore();
  });

  it('loads every public offer page using the reported count', async () => {
    const offers = Array.from({ length: 101 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { count: offers.length, data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: offers.length, data: offers.slice(100) },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenNthCalledWith(1, { limit: 100, offset: 0 });
    expect(apiGetMock).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 });
    expect(store.getOffersState.data?.count).toBe(101);
    expect(store.getOffersState.data?.data).toHaveLength(101);
  });

  it('stops at a valid reported count even when the last page is full', async () => {
    const offers = Array.from({ length: 100 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock.mockResolvedValueOnce({
      data: { count: offers.length, data: offers },
      headers: new Headers(),
    });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(store.getOffersState.data?.count).toBe(100);
    expect(store.getOffersState.data?.data).toHaveLength(100);
  });

  it('continues without a reported count until a short page', async () => {
    const offers = Array.from({ length: 101 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { data: offers.slice(100) },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 });
    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(store.getOffersState.data?.count).toBe(101);
    expect(store.getOffersState.data?.data).toHaveLength(101);
  });

  it('ignores invalid counts and requests an empty page after exact full pages', async () => {
    const offers = Array.from({ length: 200 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { count: 'invalid', data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: -1, data: offers.slice(100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: Number.NaN, data: [] },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenNthCalledWith(3, { limit: 100, offset: 200 });
    expect(apiGetMock).toHaveBeenCalledTimes(3);
    expect(store.getOffersState.data?.count).toBe(200);
    expect(store.getOffersState.data?.data).toHaveLength(200);
  });

  it('permanently disables count termination after a later inconsistent count', async () => {
    const offers = Array.from({ length: 301 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { count: 400, data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 150, data: offers.slice(100, 200) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 300, data: offers.slice(200, 300) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 300, data: offers.slice(300) },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenCalledTimes(4);
    expect(apiGetMock).toHaveBeenNthCalledWith(4, { limit: 100, offset: 300 });
    expect(store.getOffersState.data?.count).toBe(301);
    expect(store.getOffersState.data?.data).toHaveLength(301);
  });

  it('permanently disables count termination after a later missing count', async () => {
    const offers = Array.from({ length: 301 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { count: 400, data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { data: offers.slice(100, 200) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 300, data: offers.slice(200, 300) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 300, data: offers.slice(300) },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenCalledTimes(4);
    expect(store.getOffersState.data?.count).toBe(301);
    expect(store.getOffersState.data?.data).toHaveLength(301);
  });

  it('loads 401 items when a valid count is followed by inconsistent and missing counts', async () => {
    const offers = Array.from({ length: 401 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock
      .mockResolvedValueOnce({
        data: { count: 400, data: offers.slice(0, 100) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { count: 150, data: offers.slice(100, 200) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { data: offers.slice(200, 300) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { data: offers.slice(300, 400) },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        data: { data: offers.slice(400) },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenCalledTimes(5);
    expect(apiGetMock).toHaveBeenNthCalledWith(5, { limit: 100, offset: 400 });
    expect(store.getOffersState.data?.count).toBe(401);
    expect(store.getOffersState.data?.data).toHaveLength(401);
  });

  it('rejects after the configured finite page cap', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => createOffer({
      id: index + 1,
      slug: `offer-${index + 1}`,
      name: `Offer ${index + 1}`,
    }));
    apiGetMock.mockResolvedValue({
      data: { data: fullPage },
      headers: new Headers(),
    });

    const store = useRepositoryOffer();
    await expect(store.getOffers(2))
      .rejects.toThrow('Public offer pagination exceeded 2 pages.');

    expect(apiGetMock).toHaveBeenCalledTimes(2);
  });

  it('rejects legacy numeric JSON tokens from the offer API', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: createOffer({ total_shares: 1000 as never }),
      headers: new Headers(),
    });

    const store = useRepositoryOffer();
    await expect(store.getOfferOne('springfield-bond'))
      .rejects.toThrow('total_shares must be a canonical decimal string');
  });

  it('falls back to the compatibility client when the deployed offer list does not match the pinned SDK contract', async () => {
    const deployedOffers = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Deployed Offer ${index + 1}`,
      slug: `deployed-offer-${index + 1}`,
      title: `Deployed Offer ${index + 1}`,
      price_per_share: '100.00',
      min_investment: '10.00',
    })) as unknown as IOffer[];
    apiGetMock
      .mockRejectedValueOnce(Object.assign(new Error('Contract drift'), {
        code: 'SDK_RESPONSE_VALIDATION_FAILED',
      }))
      .mockResolvedValueOnce({
        data: {
          count: deployedOffers.length,
          data: deployedOffers,
        },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(store.getOffersState.data?.data).toHaveLength(deployedOffers.length);
    expect(store.getOffersState.data?.data.map((offer) => offer.slug)).toEqual(
      deployedOffers.map((offer) => offer.slug),
    );
  });

  it('skips one schema-invalid fallback offer and preserves later valid offers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sdkValidationError = Object.assign(new Error('Contract drift'), {
      code: 'SDK_RESPONSE_VALIDATION_FAILED',
    });
    apiGetMock
      .mockRejectedValueOnce(sdkValidationError)
      .mockResolvedValueOnce({
        data: {
          count: 3,
          data: [
            createOffer({ id: 1, slug: 'offer-1' }),
            createOffer({ id: 'invalid' as never, slug: 'offer-2' }),
            createOffer({ id: 3, slug: 'offer-3' }),
          ],
        },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOffers();

    expect(store.getOffersState.data?.data.map((offer) => offer.id)).toEqual([1, 3]);
    expect(store.getOffersState.data?.count).toBe(2);
    expect(consoleError).toHaveBeenCalledWith(
      'Skipping invalid offer invalid',
      expect.objectContaining({
        message: 'OfferDetailResponse response does not satisfy its compatible contract.',
      }),
    );
    consoleError.mockRestore();
  });

  it('falls back to the compatibility client when the pinned SDK contract rejects a newer offer response', async () => {
    const detailOffer = {
      id: 7,
      slug: 'springfield-bond',
      price_per_share: '100.00',
      min_investment: '10.00',
    };
    apiGetMock
      .mockRejectedValueOnce(Object.assign(new Error('Contract drift'), {
        code: 'SDK_RESPONSE_VALIDATION_FAILED',
      }))
      .mockResolvedValueOnce({
        data: detailOffer,
        headers: new Headers(),
      });

    const store = useRepositoryOffer();
    await store.getOfferOne(detailOffer.slug);

    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(store.getOfferOneState.data?.price_per_share).toBe('100');
    expect(store.getOfferOneState.data?.min_investment).toBe('10');
    expect(store.getOfferOneState.dataSource).toBe('network');
  });

  it('rejects a malformed offer detail returned by the compatibility client', async () => {
    const sdkValidationError = Object.assign(new Error('Contract drift'), {
      code: 'SDK_RESPONSE_VALIDATION_FAILED',
    });
    apiGetMock
      .mockRejectedValueOnce(sdkValidationError)
      .mockResolvedValueOnce({
        data: {
          id: 'invalid',
          slug: 'springfield-bond',
          price_per_share: '100.00',
          min_investment: '10.00',
        },
        headers: new Headers(),
      });

    const store = useRepositoryOffer();

    await expect(store.getOfferOne('springfield-bond')).rejects.toBe(
      sdkValidationError,
    );
  });

  it('loads the offer-comment schema into its canonical model state', async () => {
    const schema = { properties: { comment: { type: 'string' } } };
    apiOptionsMock.mockResolvedValueOnce({ data: schema, headers: new Headers() });
    const store = useRepositoryOffer();

    await expect(store.setOfferCommentOptions()).resolves.toEqual(schema);

    expect(apiOptionsMock).toHaveBeenCalledWith('/auth/comment');
    expect(store.setOfferCommentOptionsState).toMatchObject({
      data: schema,
      loading: false,
      error: null,
    });
  });
});
