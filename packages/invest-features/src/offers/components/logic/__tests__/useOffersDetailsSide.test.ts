import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import {
  buildExplorerAddressUrl,
  useOffersDetailsSide,
} from '../useOffersDetailsSide.ts';

vi.mock('../useOfferFilerFiles.ts', () => ({
  useOfferFilerFiles: () => ({
    isOnline: ref(true),
    filesFormatted: ref([
      {
        id: 1,
        category: 'investment-agreements',
        typeFormatted: 'Investment Agreements',
        actionUrl: '/auth/files/1',
      },
      {
        id: 2,
        category: 'financial-documents',
        typeFormatted: 'Financial Documents',
        actionUrl: '/auth/files/2',
      },
    ]),
  }),
}));

const mockClipboard = { copy: vi.fn(), copied: ref(false) };
const assetAddress = '0x1111111111111111111111111111111111111111';
const vaultAddress = '0x2222222222222222222222222222222222222222';

vi.mock('@vueuse/core', () => ({
  useClipboard: vi.fn(() => mockClipboard),
}));

describe('useOffersDetailsSide', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('computes readOnlyInfo and investmentDocUrl', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      valuationFormatted: '$1,000,000',
      securityTypeFormatted: 'SAFE',
      closeAtFormatted: '01/01/2025',
      data: {
        apy: '8%',
        distribution_frequency: 'Monthly',
        investment_strategy: 'Growth',
        estimated_hold_period: '24 months',
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);

    expect(composable.filesFormatted.value.length).toBe(2);
    expect(composable.investmentDocUrl.value).toBe('/auth/files/1');

    const info = composable.readOnlyInfo.value;
    expect(info[0].title).toBe('Share Price:');
    expect(info[0].text).toBe('$10.00');
    const closeDateItem = info.find(item => item.title === 'Close Date:');
    expect(closeDateItem?.text).toBe('01/01/2025');
  });

  it('shows Funding Goal for debt security type', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      targetRaiseFormatted: '$500,000',
      isSecurityTypeDebt: true,
      securityTypeFormatted: 'Debt',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const fundingGoalItem = info.find(item => item.title === 'Funding Goal:');
    expect(fundingGoalItem).toBeDefined();
    expect(fundingGoalItem?.text).toBe('$500,000');
    expect(fundingGoalItem?.show).toBe(true);
  });

  it('shows Funding Goal for convertible note security type', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      targetRaiseFormatted: '$500,000',
      isSecurityTypeConvertibleNote: true,
      securityTypeFormatted: 'Convertible Note',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const fundingGoalItem = info.find(item => item.title === 'Funding Goal:');
    expect(fundingGoalItem).toBeDefined();
    expect(fundingGoalItem?.text).toBe('$500,000');
    expect(fundingGoalItem?.show).toBe(true);
  });

  it('shows Target Raise and Pre-money Valuation for equity security type', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      targetRaiseFormatted: '$1,000,000',
      preMoneyValuationFormatted: '$5,000,000',
      isSecurityTypeEquity: true,
      securityTypeFormatted: 'Equity',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const targetRaiseItem = info.find(item => item.title === 'Target Raise:');
    expect(targetRaiseItem).toBeDefined();
    expect(targetRaiseItem?.text).toBe('$1,000,000');
    expect(targetRaiseItem?.show).toBe(true);

    const preMoneyItem = info.find(item => item.title === 'Pre-money Valuation:');
    expect(preMoneyItem).toBeDefined();
    expect(preMoneyItem?.text).toBe('$5,000,000');
    expect(preMoneyItem?.show).toBe(true);
  });

  it('shows Target Raise and Pre-money Valuation for preferred equity security type', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      targetRaiseFormatted: '$1,000,000',
      preMoneyValuationFormatted: '$5,000,000',
      isSecurityTypePreferredEquity: true,
      securityTypeFormatted: 'Preferred Equity',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const targetRaiseItem = info.find(item => item.title === 'Target Raise:');
    expect(targetRaiseItem).toBeDefined();
    expect(targetRaiseItem?.text).toBe('$1,000,000');
    expect(targetRaiseItem?.show).toBe(true);

    const preMoneyItem = info.find(item => item.title === 'Pre-money Valuation:');
    expect(preMoneyItem).toBeDefined();
    expect(preMoneyItem?.text).toBe('$5,000,000');
    expect(preMoneyItem?.show).toBe(true);
  });

  it('hides Funding Goal when targetRaiseFormatted is not provided for debt', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      isSecurityTypeDebt: true,
      securityTypeFormatted: 'Debt',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const fundingGoalItem = info.find(item => item.title === 'Funding Goal:');
    expect(fundingGoalItem?.show).toBe(false);
  });

  it('hides Target Raise and Pre-money Valuation when not provided for equity', () => {
    const offerRef = ref({
      pricePerShareFormatted: '$10.00',
      isSecurityTypeEquity: true,
      securityTypeFormatted: 'Equity',
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const info = composable.readOnlyInfo.value;
    
    const targetRaiseItem = info.find(item => item.title === 'Target Raise:');
    expect(targetRaiseItem?.show).toBe(false);

    const preMoneyItem = info.find(item => item.title === 'Pre-money Valuation:');
    expect(preMoneyItem?.show).toBe(false);
  });

  it('onShareClick copies window.location.href', () => {
    const offerRef = ref(undefined as any);
    const composable = useOffersDetailsSide(offerRef);
    const href = window.location.href;
    composable.onShareClick();
    expect(mockClipboard.copy).toHaveBeenCalledWith(href);
  });

  it('builds Etherscan address URLs for supported Ethereum networks', () => {
    expect(buildExplorerAddressUrl('sepolia', assetAddress)).toBe(
      `https://sepolia.etherscan.io/address/${assetAddress}`,
    );
    expect(buildExplorerAddressUrl('Ethereum Sepolia', assetAddress)).toBe(
      `https://sepolia.etherscan.io/address/${assetAddress}`,
    );
    expect(buildExplorerAddressUrl('Ethereum', assetAddress)).toBe(
      `https://etherscan.io/address/${assetAddress}`,
    );
    expect(buildExplorerAddressUrl('Ethereum Mainnet', assetAddress)).toBe(
      `https://etherscan.io/address/${assetAddress}`,
    );
  });

  it('prefers explicit explorer URLs and leaves unsupported networks or invalid addresses unlinked', () => {
    expect(buildExplorerAddressUrl(
      'Ethereum Sepolia',
      assetAddress,
      `https://explorer.example/address/${assetAddress}`,
    )).toBe(`https://explorer.example/address/${assetAddress}`);
    expect(buildExplorerAddressUrl('Polygon', assetAddress)).toBe(
      `https://polygonscan.com/address/${assetAddress}`,
    );
    expect(buildExplorerAddressUrl('sepolia', null)).toBeUndefined();
    expect(buildExplorerAddressUrl('Ethereum Sepolia', '')).toBeUndefined();
    expect(buildExplorerAddressUrl('Ethereum Sepolia', '0xAsset')).toBeUndefined();
    expect(buildExplorerAddressUrl(
      'Ethereum Sepolia',
      '',
      `https://explorer.example/address/${assetAddress}`,
    )).toBeUndefined();
  });

  it('presents finalized NAV with the fixed USDC scale instead of asset token metadata', () => {
    const offerRef = ref({
      isOpenEnded: true,
      pricePerShareFormatted: '$100.00',
      on_chain_summary: {
        network: 'base',
        asset_token: {
          standard: 'ERC-20',
          symbol: 'OTHER',
          name: 'USD Coin',
          address: assetAddress,
          decimals: 18,
        },
        vault: {
          standard: 'ERC-7540',
          address: vaultAddress,
          share_decimals: 18,
          share_symbol: 'RWA',
        },
        latest_finalized_nav: {
          id: 31,
          version: 4,
          nav_usdc_raw: '1250000',
          vault_total_supply_raw: '2500000000000000000',
          nav_share_supply_raw: '2250000000000000000',
          valuation_block_number: '123',
          valuation_as_of: '2026-07-31T12:00:00Z',
          finalized_at: '2026-07-31T12:01:00Z',
        },
        subscription_availability: { available: true, reason: null },
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const rows = Object.fromEntries(composable.readOnlyInfo.value
      .map(item => [item.title, item.text]));

    expect(rows).toMatchObject({
      'Subscriptions:': 'Open',
      'Share Price:': '$100.00',
      'Fund Structure:': 'Open-ended',
    });
    expect(rows['Latest Finalized NAV:']).toBeUndefined();
    expect(composable.latestFinalizedNav.value).toEqual({
      amount: '1.25',
      symbol: 'USDC',
      asOf: {
        label: 'As of Jul 31, 2026',
        dateTime: '2026-07-31T12:00:00.000Z',
      },
    });
    expect(composable.openEndedNavNotice.value).toBeUndefined();

    const technicalRows = Object.fromEntries((composable.onChainDetails.value ?? [])
      .map(item => [item.title, item.text]));
    expect(technicalRows).toMatchObject({
      'On-chain share supply:': '2.5 RWA',
      'NAV share supply:': '2.25 RWA',
      'NAV version:': 'v4',
    });
    expect(buildExplorerAddressUrl('base', vaultAddress))
      .toBe(`https://basescan.org/address/${vaultAddress}`);
  });

  it('keeps a valid NAV when its valuation date is absent or invalid', () => {
    const offerRef = ref({
      isOpenEnded: true,
      on_chain_summary: {
        latest_finalized_nav: {
          nav_usdc_raw: '10000000',
          valuation_as_of: 'not-a-date',
        },
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);

    expect(composable.latestFinalizedNav.value).toEqual({
      amount: '10',
      symbol: 'USDC',
      asOf: undefined,
    });
    expect(composable.openEndedNavNotice.value).toBeUndefined();
  });

  it('does not present malformed NAV data or a pending notice for a malformed record', () => {
    const offerRef = ref({
      isOpenEnded: true,
      on_chain_summary: {
        latest_finalized_nav: {
          nav_usdc_raw: 'invalid',
          valuation_as_of: '2026-08-25T00:00:00Z',
        },
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);

    expect(composable.latestFinalizedNav.value).toBeUndefined();
    expect(composable.openEndedNavNotice.value).toBeUndefined();
  });

  it('explains the initial share price once while the first NAV is pending', () => {
    const offerRef = ref({
      isOpenEnded: true,
      pricePerShareFormatted: '$100.00',
      isSecurityTypeEquity: true,
      preMoneyValuationFormatted: '$0.00',
      on_chain_summary: {
        subscription_availability: { available: true, reason: null },
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const visibleRows = composable.readOnlyInfo.value
      .filter(item => item.show !== false && item.text);

    expect(visibleRows.map(item => item.title)).toEqual([
      'Subscriptions:',
      'Initial Share Price:',
      'Fund Structure:',
    ]);
    expect(composable.openEndedNavNotice.value).toEqual({
      title: 'First NAV pending',
      text: 'The fund has not finalized its first NAV. $100.00 is the initial subscription price per share.',
    });
    expect(visibleRows.some(item => item.title === 'Pre-money Valuation:')).toBe(false);
  });

  it('admits a deployed ERC-7943 Vault while the legacy offer summary reports it unsupported', () => {
    const offerRef = ref({
      isOpenEnded: true,
      tokenization_engine: 'ERC-7943',
      on_chain_summary: {
        vault: { address: vaultAddress },
        subscription_availability: {
          available: false,
          reason: 'unsupported_tokenization_engine',
        },
      },
    } as any);

    const rows = Object.fromEntries(useOffersDetailsSide(offerRef).readOnlyInfo.value
      .map(item => [item.title, item.text]));

    expect(rows['Subscriptions:']).toBe('Open');
  });

  it('builds linked on-chain detail rows for asset token and vault', () => {
    const offerRef = ref({
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
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const rows = composable.onChainDetails.value ?? [];

    expect(rows).toEqual([
      {
        key: 'asset-token',
        title: 'Asset token:',
        text: 'ERC-20 AFNSB',
        href: `https://sepolia.etherscan.io/address/${assetAddress}`,
      },
      {
        key: 'vault',
        title: 'Vault:',
        text: 'ERC-7540',
        href: `https://sepolia.etherscan.io/address/${vaultAddress}`,
      },
    ]);
  });

  it('renders on-chain token and vault rows as plain text when addresses are missing', () => {
    const offerRef = ref({
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
    } as any);

    const composable = useOffersDetailsSide(offerRef);
    const rows = composable.onChainDetails.value ?? [];

    expect(rows.find((item) => item.key === 'asset-token')).toMatchObject({
      text: 'ERC-7943 FUND',
      href: undefined,
    });
    expect(rows.find((item) => item.key === 'vault')).toMatchObject({
      text: 'ERC-7540',
      href: undefined,
    });
  });

  it('omits missing nested on-chain rows and hides details when no summary exists', () => {
    const offerRef = ref({
      on_chain_summary: {
        network: 'Ethereum Mainnet',
      },
    } as any);

    const composable = useOffersDetailsSide(offerRef);

    expect(composable.onChainDetails.value).toEqual([]);

    offerRef.value = {} as any;
    expect(composable.onChainDetails.value).toBeUndefined();
  });
});
