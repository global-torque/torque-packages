export const EvmWalletStatusTypes = {
  created: 'created',
  verified: 'verified',
  error: 'error',
  error_retry: 'error_retry',
  error_document: 'error_document',
  error_pending: 'error_pending',
  error_suspended: 'error_suspended',
} as const;

export type EvmWalletStatusTypes =
  (typeof EvmWalletStatusTypes)[keyof typeof EvmWalletStatusTypes];

export type IEvmWalletBalancesMap = Record<string, {
  id?: number | string;
  offer_id?: number;
  address: string;
  amount: number | string;
  symbol: string;
  asset?: string;
  name?: string;
  icon?: string;
  price_per_usd?: number | string;
  price_per_usd_raw?: string;
  amount_usd?: number;
  chain?: string;
  token_decimals?: number;
  token_standard?: string;
  is_native?: boolean;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  exchange_eligible?: boolean;
  exchange_ineligible_reason?: string;
}>;

export interface IEvmWalletBalances {
  id?: number;
  offer_id?: number;
  asset?: string;
  address: string;
  amount: number;
  symbol: string;
  name?: string;
  icon?: string;
  price_per_usd?: number | string;
  price_per_usd_raw?: string;
  amount_usd?: number;
  chain?: string;
  token_decimals?: number;
  token_standard?: string;
  is_native?: boolean;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  exchange_eligible?: boolean;
  exchange_ineligible_reason?: string;
  tokenValue?: string;
}

export type IEvmWalletBalancesInput = IEvmWalletBalancesMap | IEvmWalletBalances[];

export interface IEvmWalletChainAccount {
  chain: string;
  wallet_address: string;
  chain_account_status?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
}

export interface IEvmWalletDepositInstructions {
  chain?: string;
  address?: string;
}

export interface IEvmWalletBalanceSummaryResponse {
  amount_usd?: number | string;
  token_count?: number | string;
}

export interface IEvmWalletDataResponse<TTransaction = unknown> {
  id: number;
  wallet_id?: number;
  profile_id?: number;
  status: EvmWalletStatusTypes;
  provider_name?: string;
  turnkey_org_id?: string;
  turnkey_sub_org_id?: string;
  turnkey_user_id?: string;
  turnkey_wallet_id?: string;
  turnkey_account_id?: string;
  balance: string;
  inc_balance: number;
  out_balance: number;
  address: string;
  chain?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
  deposit_instructions?: IEvmWalletDepositInstructions;
  chains?: IEvmWalletChainAccount[];
  balances: IEvmWalletBalancesMap;
  tradable_crypto_balance?: IEvmWalletBalanceSummaryResponse;
  rwa_asset_balance?: IEvmWalletBalanceSummaryResponse;
  transactions: TTransaction[];
  created_at: string;
  updated_at: string;
}

export type IEvmWalletDataForFormatter<TTransaction = unknown> =
  Omit<IEvmWalletDataResponse<TTransaction>, 'balances'> & {
    balances?: IEvmWalletBalancesInput;
  };

export const EVM_WALLET_STABLECOIN_SYMBOLS = [
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'TUSD',
  'USDP',
  'FRAX',
  'LUSD',
  'SUSD',
  'GUSD',
] as const;
const EVM_WALLET_STABLECOIN_SYMBOL_SET = new Set<string>(EVM_WALLET_STABLECOIN_SYMBOLS);

export interface EvmWalletBalanceTotalsBalance {
  id?: number | string;
  address?: string;
  asset?: string;
  name?: string;
  icon?: string;
  amount?: number | string;
  balance?: number | string;
  symbol?: string;
  price_per_usd?: number | string;
  amount_usd?: number | string;
  chain?: string;
  token_decimals?: number | string;
  token_standard?: string;
  is_native?: boolean;
}

export type EvmWalletBalanceTotalsBalances =
  | Record<string, EvmWalletBalanceTotalsBalance>
  | EvmWalletBalanceTotalsBalance[];

export interface EvmWalletBalanceTotalsInput {
  balances?: EvmWalletBalanceTotalsBalances;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
  tradable_crypto_balance?: IEvmWalletBalanceSummaryResponse;
  rwa_asset_balance?: IEvmWalletBalanceSummaryResponse;
}

export interface IEvmWalletChainAccountResponse {
  chain?: string;
  wallet_address?: string;
  chain_account_status?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
}

export interface IEvmWalletInfoStatusResponse {
  profile_id?: number;
  wallet_id?: number;
  wallet_status?: string;
  provider_name?: string;
  turnkey_org_id?: string;
  turnkey_sub_org_id?: string;
  turnkey_user_id?: string;
  turnkey_wallet_id?: string;
  turnkey_account_id?: string;
  chain?: string;
  wallet_address?: string;
  chain_account_status?: string;
  exchange_payout_token_address?: string;
  exchange_payout_token_symbol?: string;
  chains?: IEvmWalletChainAccountResponse[];
  deposit_instructions?: {
    chain?: string;
    address?: string;
  };
  balances?: IEvmWalletInfoBalanceResponse[] | Record<string, IEvmWalletInfoBalanceResponse>;
  tradable_crypto_balance?: IEvmWalletBalanceSummaryResponse;
  rwa_asset_balance?: IEvmWalletBalanceSummaryResponse;
  created_at?: string;
  updated_at?: string;
}

export type IEvmWalletInfoApiResponse<TTransaction = unknown> =
  | IEvmWalletDataResponse<TTransaction>
  | IEvmWalletInfoStatusResponse;

export interface NormalizeEvmWalletInfoOptions {
  stableCoinAddress?: string;
  stableCoinSymbol?: string;
}

export interface IEvmWalletInfoBalanceResponse {
  id?: number | string;
  offer_id?: number | string;
  asset?: string;
  asset_name?: string;
  asset_ticker?: string;
  asset_image?: string;
  symbol?: string;
  address?: string;
  amount?: number | string;
  balance?: number | string;
  name?: string;
  icon?: string;
  price_per_usd?: number | string;
  price_usd?: number | string;
  amount_usd?: number | string;
  token_address?: string;
  token_name?: string;
  token_symbol?: string;
  token_logo?: string;
  token_decimals?: number | string;
  token_standard?: string;
  chain?: string;
  is_native?: boolean;
  balance_type?: 'rwa_asset' | 'tradable_crypto';
  exchange_eligible?: boolean;
  exchange_ineligible_reason?: string;
}

const KNOWN_WALLET_STATUSES = new Set<string>(Object.values(EvmWalletStatusTypes));

const firstString = (...values: unknown[]): string =>
  values
    .map((value) => String(value ?? '').trim())
    .find(Boolean)
  ?? '';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const getWalletBalanceSummaryAmount = (
  summary?: IEvmWalletBalanceSummaryResponse,
): number | null => toNumberOrNull(summary?.amount_usd);

const getWalletBalancesArray = (
  balances?: EvmWalletBalanceTotalsBalances,
): EvmWalletBalanceTotalsBalance[] => {
  if (!balances) return [];
  return Array.isArray(balances) ? balances : Object.values(balances);
};

const isStablecoinSymbol = (symbol: unknown): boolean => (
  EVM_WALLET_STABLECOIN_SYMBOL_SET.has(String(symbol || '').toUpperCase())
);

export const calculateEvmWalletFundingBalance = (
  data: EvmWalletBalanceTotalsInput,
): number => {
  const balances = getWalletBalancesArray(data.balances);
  const payoutTokenAddress = String(data.exchange_payout_token_address ?? '').trim().toLowerCase();
  if (payoutTokenAddress) {
    const payoutToken = balances.find(
      balance => String(balance.address ?? '').trim().toLowerCase() === payoutTokenAddress,
    );
    const amount = toNumberOrNull(payoutToken?.amount);
    return amount ?? 0;
  }

  const payoutTokenSymbol = String(data.exchange_payout_token_symbol ?? '').trim().toUpperCase();
  if (payoutTokenSymbol) {
    const payoutToken = balances.find(
      balance => String(balance.symbol ?? '').trim().toUpperCase() === payoutTokenSymbol,
    );
    const amount = toNumberOrNull(payoutToken?.amount);
    return amount ?? 0;
  }

  const summaryAmount = getWalletBalanceSummaryAmount(data.tradable_crypto_balance);
  if (summaryAmount !== null) return summaryAmount;

  return balances.reduce((sum, balance) => {
    const isStablecoin = isStablecoinSymbol(balance.symbol);
    const amount = Number(balance.amount ?? 0);
    return isStablecoin ? sum + amount : sum;
  }, 0);
};

export const calculateEvmWalletRwaValue = (
  data: EvmWalletBalanceTotalsInput,
): number => {
  const summaryAmount = getWalletBalanceSummaryAmount(data.rwa_asset_balance);
  if (summaryAmount !== null) return summaryAmount;

  return getWalletBalancesArray(data.balances).reduce((sum, balance) => {
    const isStablecoin = isStablecoinSymbol(balance.symbol);
    const amount = Number(balance.amount ?? 0);
    const pricePerUsd = Number(balance.price_per_usd ?? 0);
    const valueUsd = amount * pricePerUsd;
    return !isStablecoin ? sum + valueUsd : sum;
  }, 0);
};

const normalizeWalletInfoBalances = (
  balances?: IEvmWalletInfoStatusResponse['balances'],
): IEvmWalletDataResponse['balances'] => {
  const balancesArray = Array.isArray(balances)
    ? balances
    : Object.values(balances ?? {});

  return balancesArray.reduce<IEvmWalletDataResponse['balances']>((acc, balance, index) => {
    const address = firstString(balance?.address, balance?.token_address);
    const name = firstString(
      balance?.name,
      balance?.token_name,
      balance?.asset_name,
      balance?.asset,
      balance?.symbol,
      balance?.token_symbol,
      balance?.asset_ticker,
    );
    const symbol = firstString(
      balance?.symbol,
      balance?.token_symbol,
      balance?.asset_ticker,
      balance?.asset,
      name,
    );
    const asset = firstString(balance?.asset, balance?.asset_ticker, balance?.token_symbol, symbol);
    const icon = firstString(balance?.icon, balance?.token_logo, balance?.asset_image);
    const pricePerUsdRaw = firstString(balance?.price_per_usd, balance?.price_usd);
    const pricePerUsd = toOptionalNumber(pricePerUsdRaw);
    const amountUsd = toOptionalNumber(balance?.amount_usd);
    const id = toOptionalNumber(balance?.id);
    const offerId = toOptionalNumber(balance?.offer_id);
    const tokenDecimals = toOptionalNumber(balance?.token_decimals);
    const tokenStandard = firstString(balance?.token_standard);
    const chain = firstString(balance?.chain);
    const amount = balance?.amount ?? balance?.balance ?? 0;

    if (!address && !symbol) {
      return acc;
    }

    const key = address || symbol || String(index);
    acc[key] = {
      ...(id !== undefined ? { id } : {}),
      ...(offerId !== undefined ? { offer_id: offerId } : {}),
      asset: asset || undefined,
      address,
      amount,
      symbol,
      name: name || symbol || undefined,
      ...(icon ? { icon } : {}),
      ...(pricePerUsd !== undefined ? { price_per_usd: pricePerUsd } : {}),
      ...(pricePerUsdRaw ? { price_per_usd_raw: pricePerUsdRaw } : {}),
      ...(amountUsd !== undefined ? { amount_usd: amountUsd } : {}),
      ...(chain ? { chain } : {}),
      ...(tokenDecimals !== undefined ? { token_decimals: tokenDecimals } : {}),
      ...(tokenStandard ? { token_standard: tokenStandard } : {}),
      ...(typeof balance?.is_native === 'boolean' ? { is_native: balance.is_native } : {}),
      ...(balance?.balance_type ? { balance_type: balance.balance_type } : {}),
      ...(typeof balance?.exchange_eligible === 'boolean'
        ? { exchange_eligible: balance.exchange_eligible }
        : {}),
      ...(firstString(balance?.exchange_ineligible_reason)
        ? { exchange_ineligible_reason: firstString(balance.exchange_ineligible_reason) }
        : {}),
    };
    return acc;
  }, {});
};

const reconcileConfiguredStableCoinBalance = (
  balances: IEvmWalletDataResponse['balances'],
  options: NormalizeEvmWalletInfoOptions,
): {
  balances: IEvmWalletDataResponse['balances'];
  amountUsdAdjustment: number;
} => {
  const stableCoinAddress = firstString(options.stableCoinAddress).toLowerCase();
  const stableCoinSymbol = firstString(options.stableCoinSymbol, 'USDC').toUpperCase();
  if (!stableCoinAddress || !stableCoinSymbol) {
    return { balances, amountUsdAdjustment: 0 };
  }

  let amountUsdAdjustment = 0;
  let matched = false;
  const reconciledBalances = Object.entries(balances).reduce<IEvmWalletDataResponse['balances']>(
    (result, [key, balance]) => {
      if (String(balance.address ?? '').trim().toLowerCase() !== stableCoinAddress) {
        result[key] = balance;
        return result;
      }

      matched = true;
      const amount = toNumberOrNull(balance.amount) ?? 0;
      const previousAmountUsd = toNumberOrNull(balance.amount_usd) ?? 0;
      amountUsdAdjustment += amount - previousAmountUsd;

      result[key] = {
        ...balance,
        asset: stableCoinSymbol,
        symbol: stableCoinSymbol,
        name: stableCoinSymbol,
        price_per_usd: 1,
        price_per_usd_raw: '1',
        amount_usd: amount,
        balance_type: 'tradable_crypto',
      };
      return result;
    },
    {},
  );

  return {
    balances: matched ? reconciledBalances : balances,
    amountUsdAdjustment,
  };
};

const normalizeWalletBalanceSummary = (
  summary?: IEvmWalletBalanceSummaryResponse | null,
): IEvmWalletBalanceSummaryResponse | undefined => {
  if (!summary) return undefined;

  const tokenCount = toOptionalNumber(summary.token_count);
  return {
    amount_usd: String(summary.amount_usd ?? '0'),
    token_count: tokenCount ?? 0,
  };
};

const adjustWalletBalanceSummary = (
  summary: IEvmWalletBalanceSummaryResponse | undefined,
  amountUsdAdjustment: number,
): IEvmWalletBalanceSummaryResponse | undefined => {
  if (!summary || !Number.isFinite(amountUsdAdjustment) || amountUsdAdjustment === 0) {
    return summary;
  }

  const currentAmount = toNumberOrNull(summary.amount_usd) ?? 0;
  return {
    ...summary,
    amount_usd: String(currentAmount + amountUsdAdjustment),
  };
};

const normalizeStatus = (
  walletStatus?: string | null,
  chainStatuses: string[] = [],
): EvmWalletStatusTypes => {
  const normalizedWalletStatus = String(walletStatus ?? '').trim().toLowerCase();
  if (KNOWN_WALLET_STATUSES.has(normalizedWalletStatus)) {
    return normalizedWalletStatus as EvmWalletStatusTypes;
  }

  const knownChainStatus = chainStatuses.find((status) => KNOWN_WALLET_STATUSES.has(status));
  if (knownChainStatus) {
    return knownChainStatus as EvmWalletStatusTypes;
  }

  return EvmWalletStatusTypes.created;
};

export const isEvmWalletLegacyResponse = <TTransaction = unknown>(
  data: IEvmWalletInfoApiResponse<TTransaction>,
): data is IEvmWalletDataResponse<TTransaction> => (
  'status' in data
  && 'balance' in data
  && 'transactions' in data
);

export const normalizeEvmWalletInfoResponse = <TTransaction = unknown>(
  data: IEvmWalletInfoApiResponse<TTransaction>,
  options: NormalizeEvmWalletInfoOptions = {},
): IEvmWalletDataResponse<TTransaction> => {
  if (isEvmWalletLegacyResponse(data)) {
    const reconciled = reconcileConfiguredStableCoinBalance(data.balances, options);
    return reconciled.balances === data.balances
      ? data
      : {
        ...data,
        balances: reconciled.balances,
        tradable_crypto_balance: adjustWalletBalanceSummary(
          data.tradable_crypto_balance,
          reconciled.amountUsdAdjustment,
        ),
      };
  }

  const chains = Array.isArray(data.chains) ? data.chains : [];
  const rootChain = String(data.chain ?? '').trim();
  const rootWalletAddress = String(data.wallet_address ?? '').trim();
  const rootChainAccountStatus = String(data.chain_account_status ?? '').trim().toLowerCase();
  const normalizedInputChains = [
    ...chains,
    ...((rootChain || rootWalletAddress || rootChainAccountStatus) && !chains.some((chain) => (
      String(chain.chain ?? '').trim().toLowerCase() === rootChain.toLowerCase()
    ))
      ? [{
        chain: rootChain,
        wallet_address: rootWalletAddress,
        chain_account_status: rootChainAccountStatus,
        exchange_payout_token_address: data.exchange_payout_token_address,
        exchange_payout_token_symbol: data.exchange_payout_token_symbol,
      }]
      : []),
  ];
  const chainStatuses = normalizedInputChains
    .map((chain) => String(chain.chain_account_status ?? '').trim().toLowerCase())
    .filter(Boolean);
  const normalizedChains: IEvmWalletChainAccount[] = normalizedInputChains
    .map((chain) => {
      const chainAccountStatus = String(chain.chain_account_status ?? '').trim().toLowerCase();
      const payoutTokenAddress = firstString(chain.exchange_payout_token_address);
      const payoutTokenSymbol = firstString(chain.exchange_payout_token_symbol);
      return {
        chain: String(chain.chain ?? '').trim(),
        wallet_address: String(chain.wallet_address ?? '').trim(),
        ...(chainAccountStatus ? { chain_account_status: chainAccountStatus } : {}),
        ...(payoutTokenAddress ? { exchange_payout_token_address: payoutTokenAddress } : {}),
        ...(payoutTokenSymbol ? { exchange_payout_token_symbol: payoutTokenSymbol } : {}),
      };
    })
    .filter((chain) => Boolean(chain.chain));
  const firstWalletAddress = normalizedChains
    .map((chain) => String(chain.wallet_address ?? '').trim())
    .find(Boolean)
    ?? '';
  const depositInstructionAddress = String(data.deposit_instructions?.address ?? '').trim();
  const address = firstWalletAddress
    || rootWalletAddress
    || depositInstructionAddress
    || '';
  const depositInstructions = data.deposit_instructions
    ? {
      chain: String(data.deposit_instructions.chain ?? '').trim() || undefined,
      address: String(data.deposit_instructions.address ?? '').trim() || undefined,
    }
    : undefined;
  const updatedAt = data.updated_at ?? data.created_at ?? new Date().toISOString();
  const normalizedBalances = normalizeWalletInfoBalances(data.balances);
  const reconciled = reconcileConfiguredStableCoinBalance(normalizedBalances, options);
  const tradableCryptoBalance = adjustWalletBalanceSummary(
    normalizeWalletBalanceSummary(data.tradable_crypto_balance),
    reconciled.amountUsdAdjustment,
  );
  const rwaAssetBalance = normalizeWalletBalanceSummary(data.rwa_asset_balance);
  const providerName = String(data.provider_name ?? '').trim();
  const turnkeyOrgID = firstString(data.turnkey_org_id);
  const turnkeySubOrgID = firstString(data.turnkey_sub_org_id);
  const turnkeyUserID = firstString(data.turnkey_user_id);
  const turnkeyWalletID = firstString(data.turnkey_wallet_id);
  const turnkeyAccountID = firstString(data.turnkey_account_id);

  return {
    id: Number(data.profile_id ?? data.wallet_id ?? 0),
    ...(data.wallet_id != null ? { wallet_id: Number(data.wallet_id) } : {}),
    status: normalizeStatus(data.wallet_status, chainStatuses),
    ...(providerName ? { provider_name: providerName } : {}),
    ...(turnkeyOrgID ? { turnkey_org_id: turnkeyOrgID } : {}),
    ...(turnkeySubOrgID ? { turnkey_sub_org_id: turnkeySubOrgID } : {}),
    ...(turnkeyUserID ? { turnkey_user_id: turnkeyUserID } : {}),
    ...(turnkeyWalletID ? { turnkey_wallet_id: turnkeyWalletID } : {}),
    ...(turnkeyAccountID ? { turnkey_account_id: turnkeyAccountID } : {}),
    balance: '0',
    inc_balance: 0,
    out_balance: 0,
    address,
    ...(rootChain ? { chain: rootChain } : {}),
    ...(firstString(data.exchange_payout_token_address)
      ? { exchange_payout_token_address: firstString(data.exchange_payout_token_address) }
      : {}),
    ...(firstString(data.exchange_payout_token_symbol)
      ? { exchange_payout_token_symbol: firstString(data.exchange_payout_token_symbol) }
      : {}),
    deposit_instructions: depositInstructions,
    chains: normalizedChains,
    balances: reconciled.balances,
    ...(tradableCryptoBalance ? { tradable_crypto_balance: tradableCryptoBalance } : {}),
    ...(rwaAssetBalance ? { rwa_asset_balance: rwaAssetBalance } : {}),
    transactions: [],
    created_at: data.created_at ?? updatedAt,
    updated_at: updatedAt,
  };
};

export const extractDepositAddressFromWalletInfo = (
  data: IEvmWalletInfoApiResponse,
): string => {
  if (isEvmWalletLegacyResponse(data)) {
    return String(data.address ?? '').trim();
  }

  const depositInstructionAddress = String(data.deposit_instructions?.address ?? '').trim();
  if (depositInstructionAddress) {
    return depositInstructionAddress;
  }

  const balances = Array.isArray(data.balances)
    ? data.balances
    : Object.values(data.balances ?? {});
  const usdcBalanceAddress = balances
    .find((balance) => {
      const asset = firstString(
        balance?.asset,
        balance?.symbol,
        balance?.token_symbol,
        balance?.asset_ticker,
      ).toUpperCase();
      return asset === 'USDC';
    });
  const usdcAddress = firstString(usdcBalanceAddress?.address, usdcBalanceAddress?.token_address);
  if (usdcAddress) {
    return usdcAddress;
  }

  const normalizedWallet = normalizeEvmWalletInfoResponse(data);
  return String(normalizedWallet.address ?? '').trim();
};
