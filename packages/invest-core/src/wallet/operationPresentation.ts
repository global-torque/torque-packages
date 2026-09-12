import type { WalletAuthOperationIntent } from './auth.ts';

export type WalletAuthOperationLink = {
  href: string;
  text: string;
  title: string;
  ariaLabel: string;
};

export const shortenWalletAuthOperationText = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length <= 20) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
};

export const formatWalletAuthAddressValue = (value: string) => (
  shortenWalletAuthOperationText(value)
);

export const formatWalletAuthAssetValue = (symbol: string, address: string) => {
  const formattedSymbol = symbol.trim();
  const formattedAddress = address.trim();

  if (!formattedAddress) {
    return formattedSymbol;
  }

  if (!formattedSymbol || formattedSymbol.toLowerCase() === formattedAddress.toLowerCase()) {
    return formatWalletAuthAddressValue(formattedAddress);
  }

  return `${formattedSymbol} (${formatWalletAuthAddressValue(formattedAddress)})`;
};

export const buildWalletAuthExplorerLink = ({
  baseUrl,
  type,
  value,
  text,
  ariaLabel,
}: {
  baseUrl: string;
  type: 'address' | 'token';
  value: string;
  text: string;
  ariaLabel: string;
}): WalletAuthOperationLink | null => {
  const trimmedValue = value.trim();
  const trimmedBaseUrl = baseUrl.trim().replace(/\/$/, '');

  if (!trimmedValue || !trimmedBaseUrl) {
    return null;
  }

  return {
    href: `${trimmedBaseUrl}/${type}/${trimmedValue}`,
    text,
    title: trimmedValue,
    ariaLabel,
  };
};

const EXPLORER_BASE_BY_CHAIN: Readonly<Record<string, string>> = {
  ethereum: 'https://etherscan.io',
  'ethereum-mainnet': 'https://etherscan.io',
  mainnet: 'https://etherscan.io',
  homestead: 'https://etherscan.io',
  'ethereum-sepolia': 'https://sepolia.etherscan.io',
  'ethereum sepolia': 'https://sepolia.etherscan.io',
  sepolia: 'https://sepolia.etherscan.io',
  polygon: 'https://polygonscan.com',
  base: 'https://basescan.org',
};

const getChainExplorerBaseUrl = (chain: string | null | undefined) => (
  chain ? EXPLORER_BASE_BY_CHAIN[chain.trim().toLowerCase()] : undefined
);

/** Builds a transaction link from the Vault deployment chain, without a network default. */
export const buildChainExplorerTransactionUrl = (
  chain: string | null | undefined,
  transactionHash: string | null | undefined,
): string | null => {
  const base = getChainExplorerBaseUrl(chain);
  return base && transactionHash ? `${base}/tx/${transactionHash}` : null;
};

/** Builds an address link from the Vault deployment chain, without a network default. */
export const buildChainExplorerAddressUrl = (
  chain: string | null | undefined,
  address: string | null | undefined,
): string | null => {
  const base = getChainExplorerBaseUrl(chain);
  const normalizedAddress = address?.trim();
  return base && normalizedAddress && /^0x[0-9a-f]{40}$/i.test(normalizedAddress)
    ? `${base}/address/${normalizedAddress}`
    : null;
};

export const getWalletAuthExchangeTargetAssetAddress = (
  intent: WalletAuthOperationIntent,
) => (intent.source === 'exchange' ? intent.toAssetAddress : '');
