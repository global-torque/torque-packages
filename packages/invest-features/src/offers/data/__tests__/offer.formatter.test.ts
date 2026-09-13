import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  resetInvestDataClientConfig,
  setInvestDataClientConfig,
} from '@global-torque/invest-data/service/dataClientConfig';
import { OfferFormatter as CoreOfferFormatter } from '@global-torque/invest-core/offer/formatter';
import { buildPublicFilerImageUrl } from '@global-torque/invest-data/filer';
import defaultOfferImage from '../../assets/default.svg?url';
import type { IOffer } from '@global-torque/domain-types/offerTypes';

class OfferFormatter extends CoreOfferFormatter {
  constructor(offer?: IOffer) {
    super(offer, {
      fallbackImage: defaultOfferImage,
      resolveImage: buildPublicFilerImageUrl,
    });
  }
}

type OfferWithApiImage = IOffer & {
  image?: {
    url?: string;
    meta_data?: {
      big?: string;
      medium?: string;
      small?: string;
    };
  };
};

const createOffer = (overrides: Partial<OfferWithApiImage> = {}): OfferWithApiImage => ({
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

describe('OfferFormatter', () => {
  beforeEach(() => {
    setInvestDataClientConfig({
      apiUrls: {
        filer: 'https://files.example.com/filer-api/v1.0',
      },
    });
  });

  afterEach(() => {
    resetInvestDataClientConfig();
  });

  it('uses embedded API image metadata when image_link_id is unavailable', () => {
    const offer = createOffer({
      image_link_id: 0,
      image: {
        meta_data: {
          small: 'https://cdn.test/offers/small.jpg',
          medium: 'https://cdn.test/offers/medium.jpg',
          big: 'https://cdn.test/offers/big.jpg',
        },
      },
    });

    const formatted = new OfferFormatter(offer).format();

    expect(formatted.imageSmall).toBe('https://cdn.test/offers/small.jpg');
    expect(formatted.imageMedium).toBe('https://cdn.test/offers/medium.jpg');
    expect(formatted.imageBig).toBe('https://cdn.test/offers/big.jpg');
    expect(formatted.isDefaultImage).toBe(false);
  });

  it('prefers embedded API image metadata over image_link_id and normalizes filer placeholders', () => {
    const offer = createOffer({
      image_link_id: 20,
      image: {
        meta_data: {
          small: '::filer-api::/v1.0/public/files/946742',
          medium: '::filer-api::/v1.0/public/files/946742?size=small',
          big: '::filer-api::/v1.0/public/files/946742?size=medium',
        },
      },
    });

    const formatted = new OfferFormatter(offer).format();

    expect(formatted.imageSmall).toBe(
      'https://files.example.com/filer-api/v1.0/public/files/946742?size=small',
    );
    expect(formatted.imageMedium).toBe(
      'https://files.example.com/filer-api/v1.0/public/files/946742?size=medium',
    );
    expect(formatted.imageBig).toBe(
      'https://files.example.com/filer-api/v1.0/public/files/946742?size=big',
    );
    expect(formatted.isDefaultImage).toBe(false);
  });

  it('uses the embedded API image url as a fallback source', () => {
    const offer = createOffer({
      image_link_id: 0,
      image: {
        url: 'https://cdn.test/offers/original.jpg',
      },
    });

    const formatted = new OfferFormatter(offer).format();

    expect(formatted.imageSmall).toBe('https://cdn.test/offers/original.jpg');
    expect(formatted.imageMedium).toBe('https://cdn.test/offers/original.jpg');
    expect(formatted.imageBig).toBe('https://cdn.test/offers/original.jpg');
    expect(formatted.isDefaultImage).toBe(false);
  });

  it('formats unsafe and fractional decimals without converting them to numbers', () => {
    const formatted = new OfferFormatter(createOffer({
      price_per_share: '9007199254740993.125',
      min_investment: '0.000000000000000001',
      total_shares: '99999999999999999999.999999999999999999',
      subscribed_shares: '0.000000000000000001',
      confirmed_shares: '0',
    })).format();

    expect(formatted.pricePerShareFormatted).toBe('$9,007,199,254,740,993.13');
    expect(formatted.minInvestment).toBe('0.000000000000000001');
  });

  it('rejects numeric tokens for decimal contract fields', () => {
    expect(() => new OfferFormatter(createOffer({ price_per_share: 100 as never })))
      .toThrow('price_per_share must be a canonical decimal string');
  });

  it('enforces published offer share invariants while preserving the open-ended sentinel', () => {
    expect(() => new OfferFormatter(createOffer({ price_per_share: '0' })))
      .toThrow('price_per_share must be greater than zero');
    expect(() => new OfferFormatter(createOffer({ confirmed_shares: '251' })))
      .toThrow('confirmed_shares must not exceed subscribed_shares');
    expect(() => new OfferFormatter(createOffer({ subscribed_shares: '1001' })))
      .toThrow('subscribed_shares must not exceed total_shares');
    expect(() => new OfferFormatter(createOffer({ min_investment: '1001' })))
      .not.toThrow();
    expect(() => new OfferFormatter(createOffer({
      fund_structure: 'open_ended',
      total_shares: '0',
      subscribed_shares: '1001',
      confirmed_shares: '2001',
      min_investment: '1001',
    }))).not.toThrow();
    const openEndedOverInformationalTotal = new OfferFormatter(createOffer({
      fund_structure: 'open_ended',
      total_shares: '1000',
      subscribed_shares: '1001',
      confirmed_shares: '1001',
    })).format();
    expect(openEndedOverInformationalTotal.isFullyFunded).toBe(false);
    expect(openEndedOverInformationalTotal.isClosingSoon).toBe(false);
    expect(openEndedOverInformationalTotal.isSharesReached).toBe(false);
    expect(() => new OfferFormatter(createOffer({ total_shares: '0' })))
      .toThrow('total_shares must be greater than zero');
  });

  it('accepts finalized share counters for read-only closed offers', () => {
    for (const status of ['legal_closed', 'closed_successfully', 'closed_unsuccessfully']) {
      expect(() => new OfferFormatter(createOffer({ status, confirmed_shares: '251' })))
        .not.toThrow();
    }
  });

  it('allows zero price and total shares only for drafts, but keeps minimum amount positive', () => {
    expect(() => new OfferFormatter(createOffer({
      status: 'draft',
      price_per_share: '0',
      total_shares: '0',
    }))).not.toThrow();
    expect(() => new OfferFormatter(createOffer({ status: 'draft', min_investment: '0' })))
      .toThrow('min_investment must be greater than zero');
  });
});
