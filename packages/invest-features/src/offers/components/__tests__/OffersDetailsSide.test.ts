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
});
