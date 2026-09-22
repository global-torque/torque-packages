import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import OffersDetailsSide from '../OffersDetailsSide.vue';

vi.mock('@global-torque/invest-widgets/icons/images/share.svg', () => ({
  default: {
    name: 'ShareIcon',
    template: '<span />',
  },
}));

vi.mock('@global-torque/invest-widgets/icons/images/file.svg', () => ({
  default: {
    name: 'FileIcon',
    template: '<span />',
  },
}));

vi.mock('@global-torque/invest-widgets/icons/images/circle-info.svg', () => ({
  default: {
    name: 'InfoIcon',
    template: '<span />',
  },
}));

vi.mock('../OffersDetailsBtn.vue', () => ({
  default: {
    name: 'OffersDetailsBtn',
    template: '<button data-testid="offer-invest-button" />',
  },
}));

vi.mock('../logic/useOfferFilerFiles.ts', () => ({
  useOfferFilerFiles: () => ({ filesFormatted: ref([]), isOnline: ref(true) }),
}));

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useClipboard: vi.fn(() => ({
    copy: vi.fn(),
    copied: ref(false),
  })),
}));

const openContactUsDialog = vi.fn();
const assetAddress = '0x1111111111111111111111111111111111111111';
const vaultAddress = '0x2222222222222222222222222222222222222222';

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: () => ({
    openContactUsDialog,
  }),
}));

const baseOffer = {
  offerFundedPercent: 25,
  minInvestmentFormatted: '$1,000',
  isSharesReached: false,
  pricePerShareFormatted: '$100.00',
  targetRaiseFormatted: '$1,000,000',
  isSecurityTypeDebt: true,
  securityTypeFormatted: 'Debt',
  closeAtFormatted: 'not closed',
};

const mountSide = (
  offer: Record<string, unknown> = {},
  transactional = false,
) => mount(OffersDetailsSide, {
  props: {
    offer: {
      ...baseOffer,
      ...offer,
    },
    loading: false,
    transactional,
  },
  global: {
    stubs: {},
  },
});

describe('OffersDetailsSide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows investment controls only after live published verification', () => {
    expect(mountSide().find('[data-testid="offer-invest-button"]').exists()).toBe(false);
    expect(mountSide({}, true).find('[data-testid="offer-invest-button"]').exists()).toBe(true);
  });

  it('hides the on-chain details group when no summary exists', () => {
    const wrapper = mountSide();

    expect(wrapper.find('[data-testid="offer-on-chain-details"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('On-chain details');
  });

  it('renders linked asset token and vault rows', () => {
    const wrapper = mountSide({
      on_chain_summary: {
        network: 'sepolia',
        asset_token: {
          standard: 'ERC-20',
          symbol: 'AFNSB',
          name: 'AFNSB Token',
          address: assetAddress,
        },
        vault: {
          standard: 'ERC-7540',
          address: vaultAddress,
        },
      },
    });

    const details = wrapper.get('[data-testid="offer-on-chain-details"]');
    expect(details.text()).toContain('On-chain details');
    expect(details.attributes('open')).toBeUndefined();
    expect(wrapper.find('[data-row-key="network"]').exists()).toBe(false);

    const assetLink = wrapper.get('[data-row-key="asset-token"] a');
    expect(assetLink.text()).toBe('ERC-20 AFNSB');
    expect(assetLink.attributes('href')).toBe(`https://sepolia.etherscan.io/address/${assetAddress}`);

    const vaultLink = wrapper.get('[data-row-key="vault"] a');
    expect(vaultLink.text()).toBe('ERC-7540');
    expect(vaultLink.attributes('href')).toBe(`https://sepolia.etherscan.io/address/${vaultAddress}`);
  });

  it('renders asset token and vault rows as plain text when addresses are missing', () => {
    const wrapper = mountSide({
      on_chain_summary: {
        network: 'Ethereum',
        asset_token: {
          standard: 'ERC-7943',
          symbol: 'FUND',
          name: 'Fund Token',
          address: '',
        },
        vault: {
          standard: 'ERC-7540',
        },
      },
    });

    const assetRow = wrapper.get('[data-row-key="asset-token"]');
    expect(assetRow.text()).toContain('ERC-7943 FUND');
    expect(assetRow.find('a').exists()).toBe(false);

    const vaultRow = wrapper.get('[data-row-key="vault"]');
    expect(vaultRow.text()).toContain('ERC-7540');
    expect(vaultRow.find('a').exists()).toBe(false);
  });

  it('shows one pending-NAV notice and removes open-fund valuation noise', () => {
    const wrapper = mountSide({
      isOpenEnded: true,
      pricePerShareFormatted: '$100.00',
      preMoneyValuationFormatted: '$0.00',
      isSecurityTypeEquity: true,
      on_chain_summary: {
        subscription_availability: { available: true, reason: null },
      },
    });

    const notice = wrapper.get('[data-testid="offer-nav-notice"]');
    expect(notice.text()).toContain('First NAV pending');
    expect(notice.text()).toContain('$100.00 is the initial subscription price per share.');
    expect(wrapper.text()).toContain('Subscriptions:Open');
    expect(wrapper.text()).toContain('Initial Share Price:$100.00');
    expect(wrapper.text()).not.toContain('Awaiting finalized supply snapshot');
    expect(wrapper.text()).not.toContain('Pre-money Valuation');
  });

  it('renders finalized NAV as a semantic responsive block with a normalized date', () => {
    const wrapper = mountSide({
      isOpenEnded: true,
      on_chain_summary: {
        asset_token: {
          standard: 'ERC-20',
          symbol: 'OTHER',
          name: 'Other token',
          decimals: 18,
        },
        latest_finalized_nav: {
          nav_usdc_raw: '10000000',
          valuation_as_of: '2026-08-25T12:00:00-04:00',
        },
      },
    });

    const block = wrapper.get('dl[data-testid="offer-finalized-nav"]');
    expect(block.get('dt').text()).toBe('Latest Finalized NAV');
    expect(block.get('[data-testid="offer-finalized-nav-amount"]').text()).toBe('10 USDC');
    expect(block.get('time').text()).toBe('As of Aug 25, 2026');
    expect(block.get('time').attributes('datetime')).toBe('2026-08-25T16:00:00.000Z');
    expect(wrapper.text()).not.toContain('0.00000000001 USDC');
    expect(wrapper.text()).not.toContain('Latest Finalized NAV:');
  });

  it('does not show a pending notice for malformed finalized NAV data', () => {
    const wrapper = mountSide({
      isOpenEnded: true,
      on_chain_summary: {
        latest_finalized_nav: {
          nav_usdc_raw: 'not-a-number',
          valuation_as_of: '2026-08-25T12:00:00Z',
        },
      },
    });

    expect(wrapper.find('[data-testid="offer-finalized-nav"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="offer-nav-notice"]').exists()).toBe(false);
  });
});
