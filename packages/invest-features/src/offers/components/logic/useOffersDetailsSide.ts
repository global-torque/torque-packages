import { computed, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useClipboard } from '@vueuse/core';
import type { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { useOfferFilerFiles } from './useOfferFilerFiles.ts';
import { formatRawAmount } from '@global-torque/invest-core/investment/rawAmount';

export interface ReadOnlyInfoItem {
  title?: string;
  text?: string | number;
  value?: string;
  tooltip?: string;
  show?: boolean;
}

export interface LatestFinalizedNavPresentation {
  amount: string;
  symbol: 'USDC';
  asOf?: {
    label: string;
    dateTime: string;
  };
}

const NAV_USDC_DECIMALS = 6;
const NAV_USDC_SYMBOL = 'USDC' as const;

export interface OnChainDetailsItem {
  key: 'current-supply' | 'nav-supply' | 'nav-version' | 'asset-token' | 'vault';
  title: string;
  text: string;
  href?: string;
}

function formatValuationDate(value: string | undefined) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return {
    label: `As of ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)}`,
    dateTime: date.toISOString(),
  };
}

export function buildExplorerAddressUrl(
  network: string | undefined,
  address: string | null | undefined,
  explorerUrl?: string,
) {
  const normalizedAddress = address?.trim();
  if (!normalizedAddress || !/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
    return undefined;
  }

  if (explorerUrl) {
    return explorerUrl;
  }

  const normalizedNetwork = network?.trim().toLowerCase();
  const baseUrlByNetwork: Record<string, string> = {
    'mainnet': 'https://etherscan.io',
    'ethereum': 'https://etherscan.io',
    'ethereum mainnet': 'https://etherscan.io',
    'ethereum-mainnet': 'https://etherscan.io',
    'homestead': 'https://etherscan.io',
    'sepolia': 'https://sepolia.etherscan.io',
    'ethereum sepolia': 'https://sepolia.etherscan.io',
    'ethereum-sepolia': 'https://sepolia.etherscan.io',
    'polygon': 'https://polygonscan.com',
    'base': 'https://basescan.org',
  };
  const baseUrl = normalizedNetwork ? baseUrlByNetwork[normalizedNetwork] : undefined;

  return baseUrl ? `${baseUrl}/address/${normalizedAddress}` : undefined;
}

export function useOffersDetailsSide(offerRef: Ref<IOfferFormatted | undefined>) {
  const { filesFormatted, isOnline } = useOfferFilerFiles(offerRef);

  const { copy, copied } = useClipboard({ legacy: true });
  const isOpenEnded = computed(() => offerRef.value?.isOpenEnded === true);
  const openEndedProtocolInfo = computed<ReadOnlyInfoItem[]>(() => {
    if (!isOpenEnded.value) return [];
    const summary = offerRef.value?.on_chain_summary;
    const availability = summary?.subscription_availability;
    const erc7943VaultReady = offerRef.value?.tokenization_engine === 'ERC-7943'
      && availability?.reason === 'unsupported_tokenization_engine'
      && /^0x[a-fA-F0-9]{40}$/.test(summary?.vault?.address ?? '');
    const availabilityReason: Record<string, string> = {
      offer_not_published: 'Unavailable — offer is not published',
      not_open_ended: 'Unavailable — fund is not open-ended',
      unsupported_tokenization_engine: 'Unavailable — tokenization engine is unsupported',
      vault_not_deployed: 'Unavailable — Vault is not deployed',
    };

    return [
      {
        title: 'Subscriptions:',
        text: availability?.available || erc7943VaultReady
          ? 'Open'
          : availability?.reason
            ? availabilityReason[availability.reason]
            : 'Availability pending',
      },
      {
        title: summary?.latest_finalized_nav ? 'Share Price:' : 'Initial Share Price:',
        text: offerRef.value?.pricePerShareFormatted,
      },
      { title: 'Fund Structure:', text: 'Open-ended' },
      {
        title: 'Investment Strategy:',
        text: offerRef.value?.data?.investment_strategy,
      },
      {
        title: 'Distribution Frequency:',
        text: offerRef.value?.data?.distribution_frequency,
      },
      {
        title: 'Estimated Hold Period:',
        text: offerRef.value?.data?.estimated_hold_period,
      },
    ];
  });

  const latestFinalizedNav = computed<LatestFinalizedNavPresentation | undefined>(() => {
    if (!isOpenEnded.value) return undefined;

    const nav = offerRef.value?.on_chain_summary?.latest_finalized_nav;
    if (!nav) return undefined;

    const amount = typeof nav.nav_usdc_raw === 'string'
      ? formatRawAmount(nav.nav_usdc_raw, NAV_USDC_DECIMALS)
      : '';
    if (!amount) return undefined;

    return {
      amount,
      symbol: NAV_USDC_SYMBOL,
      asOf: typeof nav.valuation_as_of === 'string'
        ? formatValuationDate(nav.valuation_as_of)
        : undefined,
    };
  });

  const openEndedNavNotice = computed(() => {
    if (!isOpenEnded.value || offerRef.value?.on_chain_summary?.latest_finalized_nav) {
      return undefined;
    }

    const price = offerRef.value?.pricePerShareFormatted;
    return {
      title: 'First NAV pending',
      text: price
        ? `The fund has not finalized its first NAV. ${price} is the initial subscription price per share.`
        : 'The fund has not finalized its first NAV. The initial subscription price will appear when available.',
    };
  });

  const readOnlyInfo = computed<ReadOnlyInfoItem[]>(() => ([
    ...openEndedProtocolInfo.value,
    ...(!isOpenEnded.value ? [{
      title: 'Share Price:',
      text: offerRef.value?.pricePerShareFormatted,
    }] : []),
    {
      title: 'Funding Goal:',
      text: offerRef.value?.targetRaiseFormatted,
      show: !isOpenEnded.value && !!(offerRef.value?.targetRaiseFormatted
        && (offerRef.value?.isSecurityTypeDebt || offerRef.value?.isSecurityTypeConvertibleDebt
        || offerRef.value?.isSecurityTypeConvertibleNote)),
    },
    {
      title: 'Target Raise:',
      text: offerRef.value?.targetRaiseFormatted,
      show: !isOpenEnded.value && !!(offerRef.value?.targetRaiseFormatted
        && (offerRef.value?.isSecurityTypeEquity || offerRef.value?.isSecurityTypePreferredEquity)),
    },
    {
      title: 'Pre-money Valuation:',
      text: offerRef.value?.preMoneyValuationFormatted,
      show: !isOpenEnded.value && !!(offerRef.value?.preMoneyValuationFormatted
        && (offerRef.value?.isSecurityTypeEquity || offerRef.value?.isSecurityTypePreferredEquity)),
    },
    {
      title: 'Security Type:',
      text: offerRef.value?.securityTypeFormatted,
      tooltip: offerRef.value?.securityTypeTooltip,
    },
    {
      title: 'Interest Rate:',
      text: offerRef.value?.data?.apy,
    },
    {
      title: 'Distribution Frequency:',
      text: offerRef.value?.data?.distribution_frequency,
      show: !isOpenEnded.value,
    },
    {
      title: 'Investment Strategy:',
      text: offerRef.value?.data?.investment_strategy,
      show: !isOpenEnded.value,
    },
    {
      title: 'Estimated Hold Period:',
      text: offerRef.value?.data?.estimated_hold_period,
      show: !isOpenEnded.value,
    },
    {
      title: 'Close Date:',
      text: offerRef.value?.closeAtFormatted,
      show: !isOpenEnded.value,
      tooltip: 'Closing offer date may vary depending on factors such as property type, financing conditions, buyer readiness, or legal requirements.',
    },
    {
      title: 'Voting Rights:',
      text: offerRef.value?.votingRightsFormatted,
    },
    {
      title: 'Liquidation Preference:',
      text: offerRef.value?.liquidationPreferenceFormatted,
    },
    {
      title: 'Dividend Type:',
      text: offerRef.value?.dividendTypeFormatted,
    },
    {
      title: 'Dividend Rate:',
      text: offerRef.value?.dividendRateFormatted,
    },
    {
      title: 'Dividend Payment Frequency:',
      text: offerRef.value?.dividendPaymentFrequencyFormatted,
    },
    {
      title: 'Valuation Cap:',
      text: offerRef.value?.valuationCapFormatted,
    },
    {
      title: 'Discount Rate:',
      text: offerRef.value?.discountRateFormatted,
    },
    {
      title: 'Interest Rate:',
      text: offerRef.value?.interestRateFormatted,
    },
    {
      title: 'Maturity Date:',
      text: offerRef.value?.maturityDateFormatted,
    },
    {
      title: 'Interest Rate (APY):',
      text: offerRef.value?.interestRateApyFormatted,
    },
    {
      title: 'Payment Schedule:',
      text: offerRef.value?.paymentScheduleFormatted,
      tooltip: 'Payment schedule refers to how often interest payments are made to investors (e.g., monthly, quarterly, annually, or at maturity',
    },
    {
      title: 'Term Length:',
      text: offerRef.value?.termLengthFormatted,
    },
  ]));

  const onChainDetails = computed<OnChainDetailsItem[] | undefined>(() => {
    const summary = offerRef.value?.on_chain_summary;
    if (!summary) {
      return undefined;
    }

    const rows: OnChainDetailsItem[] = [];
    const nav = summary.latest_finalized_nav;
    const shareDecimals = summary.vault?.share_decimals;
    const shareSymbol = summary.vault?.share_symbol ?? 'RWA';

    if (nav && Number.isInteger(shareDecimals)) {
      rows.push(
        {
          key: 'current-supply',
          title: 'On-chain share supply:',
          text: `${formatRawAmount(nav.vault_total_supply_raw, shareDecimals!)} ${shareSymbol}`,
        },
        {
          key: 'nav-supply',
          title: 'NAV share supply:',
          text: `${formatRawAmount(nav.nav_share_supply_raw, shareDecimals!)} ${shareSymbol}`,
        },
        {
          key: 'nav-version',
          title: 'NAV version:',
          text: `v${nav.version}`,
        },
      );
    }

    if (summary.asset_token) {
      const assetTokenLabel = [
        summary.asset_token.standard,
        summary.asset_token.symbol,
      ].filter(Boolean).join(' ');

      if (assetTokenLabel) {
        rows.push({
          key: 'asset-token',
          title: 'Asset token:',
          text: assetTokenLabel,
          href: buildExplorerAddressUrl(
            summary.network,
            summary.asset_token.address,
            summary.asset_token.explorer_url,
          ),
        });
      }
    }

    if (summary.vault?.standard) {
      rows.push({
        key: 'vault',
        title: 'Vault:',
        text: summary.vault.standard,
        href: buildExplorerAddressUrl(
          summary.network,
          summary.vault.address,
          summary.vault.explorer_url,
        ),
      });
    }

    return rows;
  });

  const investmentDocUrl = computed(() => isOnline.value ? (
    filesFormatted.value.find((doc) => (
      doc.category === 'investment-agreements'
    ))?.actionUrl
  ) : undefined);

  const onShareClick = () => {
    copy(window?.location?.href);
  };

  return {
    filesFormatted,
    readOnlyInfo,
    latestFinalizedNav,
    openEndedNavNotice,
    onChainDetails,
    investmentDocUrl,
    isOnline,
    onShareClick,
    copied,
    isOpenEnded,
  };
}
