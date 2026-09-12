import { describe, expect, it } from 'vitest';
import {
  calculateEvmWalletFundingBalance,
  calculateEvmWalletRwaValue,
  EvmWalletStatusTypes,
  extractDepositAddressFromWalletInfo,
  isEvmWalletLegacyResponse,
  normalizeEvmWalletInfoResponse,
} from '../walletInfo.ts';

describe('walletInfo', () => {
  it('keeps the legacy wallet info payload unchanged', () => {
    const payload = {
      id: 10,
      status: EvmWalletStatusTypes.verified,
      balance: '123.45',
      inc_balance: 1,
      out_balance: 2,
      address: '0xabc',
      balances: {},
      transactions: [],
      created_at: '2026-04-08T17:35:45Z',
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(isEvmWalletLegacyResponse(payload)).toBe(true);
    expect(normalizeEvmWalletInfoResponse(payload)).toEqual(payload);
  });

  it('normalizes the new status-only wallet info payload into the legacy wallet shape', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'created',
      provider_name: 'turnkey',
      chain: 'ethereum-sepolia',
      wallet_address: '0xwallet',
      chain_account_status: 'verified',
      deposit_instructions: {
        chain: 'ethereum-sepolia',
        address: '0xdeposit',
      },
      chains: [
        { chain: 'ethereum', wallet_address: '', chain_account_status: 'pending' },
        { chain: 'polygon', wallet_address: '', chain_account_status: 'pending' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload)).toEqual({
      id: 1124,
      status: EvmWalletStatusTypes.created,
      provider_name: 'turnkey',
      balance: '0',
      inc_balance: 0,
      out_balance: 0,
      address: '0xwallet',
      chain: 'ethereum-sepolia',
      deposit_instructions: {
        chain: 'ethereum-sepolia',
        address: '0xdeposit',
      },
      chains: [
        { chain: 'ethereum', wallet_address: '', chain_account_status: 'pending' },
        { chain: 'polygon', wallet_address: '', chain_account_status: 'pending' },
        { chain: 'ethereum-sepolia', wallet_address: '0xwallet', chain_account_status: 'verified' },
      ],
      balances: {},
      transactions: [],
      created_at: '2026-04-08T17:35:45Z',
      updated_at: '2026-04-08T17:35:45Z',
    });
  });

  it('preserves profile id while exposing backend wallet_id for exchange consumers', () => {
    const payload = {
      profile_id: 1124,
      wallet_id: 44,
      wallet_status: 'verified',
      provider_name: 'turnkey',
      chain: 'ethereum-sepolia',
      wallet_address: '0xwallet',
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload)).toEqual(expect.objectContaining({
      id: 1124,
      wallet_id: 44,
      status: EvmWalletStatusTypes.verified,
    }));
  });

  it('keeps top-level chain wallet fields when backend returns an empty chains list', () => {
    const payload = {
      profile_id: 1129,
      wallet_status: 'created',
      chain: 'ethereum-sepolia',
      wallet_address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      chain_account_status: 'verified',
      balances: [],
      deposit_instructions: {
        chain: 'ethereum-sepolia',
        address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      },
      chains: [],
      updated_at: '2026-04-10T09:59:58Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload)).toEqual({
      id: 1129,
      status: EvmWalletStatusTypes.created,
      balance: '0',
      inc_balance: 0,
      out_balance: 0,
      address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      chain: 'ethereum-sepolia',
      deposit_instructions: {
        chain: 'ethereum-sepolia',
        address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      },
      chains: [
        {
          chain: 'ethereum-sepolia',
          wallet_address: '0x51da1389112a99a972b248c0510a77a9731a475b',
          chain_account_status: 'verified',
        },
      ],
      balances: {},
      transactions: [],
      created_at: '2026-04-10T09:59:58Z',
      updated_at: '2026-04-10T09:59:58Z',
    });
  });

  it('falls back to the first available chain wallet address', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      chains: [
        { chain: 'ethereum', wallet_address: '', chain_account_status: 'verified' },
        { chain: 'base', wallet_address: '0xbase', chain_account_status: 'verified' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload).address).toBe('0xbase');
  });

  it('keeps normalized chain addresses for downstream network selection', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      chains: [
        { chain: 'ethereum', wallet_address: '0xeth', chain_account_status: 'verified' },
        { chain: 'base', wallet_address: '0xbase', chain_account_status: 'verified' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload).chains).toEqual([
      { chain: 'ethereum', wallet_address: '0xeth', chain_account_status: 'verified' },
      { chain: 'base', wallet_address: '0xbase', chain_account_status: 'verified' },
    ]);
  });

  it('normalizes balances from the new wallet info payload shape', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      balances: [
        { asset: 'USDC', address: '0xusdc', amount: '10.5' },
        { symbol: 'ETH', address: '0xeth', amount: '1.25' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload).balances).toEqual({
      '0xusdc': {
        asset: 'USDC',
        address: '0xusdc',
        amount: '10.5',
        symbol: 'USDC',
        name: 'USDC',
      },
      '0xeth': {
        asset: 'ETH',
        address: '0xeth',
        amount: '1.25',
        symbol: 'ETH',
        name: 'ETH',
      },
    });
  });

  it('uses token metadata fields for normalized balance display fields', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      balances: [
        {
          asset: '',
          asset_ticker: '',
          token_address: '0xtoken',
          token_name: 'City of Springfield 2025 Infrastructure Improvement Bond',
          token_symbol: 'City of Spr',
          token_logo: 'https://assets.test/city-of-spr.png',
          price_per_usd: '12.5',
          amount_usd: '12512.50',
          amount: '1001.000000000000000000',
        },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(normalizeEvmWalletInfoResponse(payload).balances).toEqual({
      '0xtoken': {
        asset: 'City of Spr',
        address: '0xtoken',
        amount: '1001.000000000000000000',
        symbol: 'City of Spr',
        name: 'City of Springfield 2025 Infrastructure Improvement Bond',
        icon: 'https://assets.test/city-of-spr.png',
        price_per_usd: 12.5,
        price_per_usd_raw: '12.5',
        amount_usd: 12512.5,
      },
    });
  });

  it('normalizes current wallet balance response fields', () => {
    const payload = {
      wallet_status: 'created',
      chain: 'ethereum-sepolia',
      wallet_address: '0x4138b9d0897fc7c896a0294698c06a2002047178',
      chain_account_status: 'verified',
      tradable_crypto_balance: { amount_usd: '93.80', token_count: 2 },
      rwa_asset_balance: { amount_usd: '1375.00', token_count: 2 },
      balances: [
        {
          token_address: '0x764db4a08b4dfbe6fc36543ac59496b18613b0d7',
          token_name: 'VTest Series B',
          token_symbol: 'VSB',
          token_logo: 'https://assets.test/vsb.png',
          token_decimals: 18,
          token_standard: 'erc20',
          chain: 'ethereum-sepolia',
          is_native: false,
          amount: '125.000000000000000000',
          amount_usd: '1250',
        },
      ],
      updated_at: '2026-06-02T16:34:00Z',
    };

    const normalized = normalizeEvmWalletInfoResponse(payload);

    expect(normalized.balances).toEqual({
      '0x764db4a08b4dfbe6fc36543ac59496b18613b0d7': {
        asset: 'VSB',
        address: '0x764db4a08b4dfbe6fc36543ac59496b18613b0d7',
        amount: '125.000000000000000000',
        symbol: 'VSB',
        name: 'VTest Series B',
        icon: 'https://assets.test/vsb.png',
        chain: 'ethereum-sepolia',
        token_decimals: 18,
        token_standard: 'erc20',
        is_native: false,
        amount_usd: 1250,
      },
    });
    expect(normalized.tradable_crypto_balance).toEqual({ amount_usd: '93.80', token_count: 2 });
    expect(normalized.rwa_asset_balance).toEqual({ amount_usd: '1375.00', token_count: 2 });
  });

  it('preserves exchange eligibility metadata and exact quote inputs from a real wallet payload', () => {
    const payload = {
      profile_id: 1225,
      wallet_id: 41,
      wallet_status: 'verified',
      provider_name: 'turnkey',
      chain: 'ethereum-sepolia',
      wallet_address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      chain_account_status: 'verified',
      exchange_payout_token_address: '0xe2ccb3fc0153584e5c70c65849078b55597b4032',
      exchange_payout_token_symbol: 'USDC',
      chains: [{
        chain: 'ethereum-sepolia',
        wallet_address: '0x51da1389112a99a972b248c0510a77a9731a475b',
        chain_account_status: 'verified',
        exchange_payout_token_address: '0xe2ccb3fc0153584e5c70c65849078b55597b4032',
        exchange_payout_token_symbol: 'USDC',
      }],
      balances: [{
        token_address: '0x2d64b6451f0549f9b98542d74a62b956d27ae3e1',
        offer_id: 168,
        token_name: 'Test Loan LLC',
        token_symbol: 'TLLC',
        token_decimals: 18,
        token_standard: 'erc20',
        chain: 'ethereum-sepolia',
        balance_type: 'rwa_asset' as const,
        exchange_eligible: true,
        amount: '10.123456789012345678',
        price_usd: '7.161500000000000001',
      }],
      updated_at: '2026-07-11T08:00:00Z',
    };

    const normalized = normalizeEvmWalletInfoResponse(payload);

    expect(normalized).toEqual(expect.objectContaining({
      id: 1225,
      wallet_id: 41,
      chain: 'ethereum-sepolia',
      exchange_payout_token_address: '0xe2ccb3fc0153584e5c70c65849078b55597b4032',
      exchange_payout_token_symbol: 'USDC',
      chains: [expect.objectContaining({
        chain: 'ethereum-sepolia',
        exchange_payout_token_address: '0xe2ccb3fc0153584e5c70c65849078b55597b4032',
      })],
    }));
    expect(normalized.balances['0x2d64b6451f0549f9b98542d74a62b956d27ae3e1'])
      .toEqual(expect.objectContaining({
        offer_id: 168,
        balance_type: 'rwa_asset',
        exchange_eligible: true,
        chain: 'ethereum-sepolia',
        amount: '10.123456789012345678',
        price_per_usd_raw: '7.161500000000000001',
      }));
  });

  it('reconciles the configured stable coin when provider metadata is unknown', () => {
    const stableCoinAddress = '0xe2ccb3fc0153584e5c70c65849078b55597b4032';
    const payload = {
      profile_id: 1230,
      wallet_status: 'verified',
      chain: 'ethereum-sepolia',
      wallet_address: '0x51da1389112a99a972b248c0510a77a9731a475b',
      balances: [{
        token_address: stableCoinAddress,
        token_name: 'Unknown Token',
        token_symbol: stableCoinAddress,
        token_decimals: 18,
        token_standard: 'erc20',
        chain: 'ethereum-sepolia',
        amount: '25000',
        price_usd: '0',
        amount_usd: '0',
      }],
      tradable_crypto_balance: {
        amount_usd: '0.00',
        token_count: 1,
      },
      updated_at: '2026-07-25T12:00:00Z',
    };

    const normalized = normalizeEvmWalletInfoResponse(payload, {
      stableCoinAddress,
      stableCoinSymbol: 'USDC',
    });

    expect(normalized.balances[stableCoinAddress]).toEqual(expect.objectContaining({
      address: stableCoinAddress,
      asset: 'USDC',
      symbol: 'USDC',
      name: 'USDC',
      amount: '25000',
      price_per_usd: 1,
      price_per_usd_raw: '1',
      amount_usd: 25000,
      balance_type: 'tradable_crypto',
    }));
    expect(normalized.tradable_crypto_balance).toEqual({
      amount_usd: '25000',
      token_count: 1,
    });
    expect(calculateEvmWalletFundingBalance(normalized)).toBe(25000);
  });

  it('prefers deposit instructions address when present', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      deposit_instructions: {
        chain: 'ethereum',
        address: '0xinstructions',
      },
      balances: [
        { asset: 'USDC', address: '0xusdc-balance', amount: '0' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(extractDepositAddressFromWalletInfo(payload)).toBe('0xinstructions');
  });

  it('falls back to the USDC balance address when deposit instructions are empty', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      chain: 'ethereum',
      deposit_instructions: {
        chain: 'ethereum',
        address: '',
      },
      balances: [
        { asset: 'ETH', address: '0xeth-balance', amount: '1' },
        { asset: 'USDC', address: '0xusdc-balance', amount: '0' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(extractDepositAddressFromWalletInfo(payload)).toBe('0xusdc-balance');
  });

  it('falls back to token_address when extracting a USDC deposit address', () => {
    const payload = {
      profile_id: 1124,
      wallet_status: 'verified',
      balances: [
        { token_symbol: 'USDC', token_address: '0xusdc-token', amount: '0' },
      ],
      updated_at: '2026-04-08T17:35:45Z',
    };

    expect(extractDepositAddressFromWalletInfo(payload)).toBe('0xusdc-token');
  });

  it('uses wallet balance summaries before token-level fallback calculations', () => {
    const balances = [
      { address: '0xusdc', amount: '10', symbol: 'USDC' },
      { address: '0xrwa', amount: '2', symbol: 'RWA', price_per_usd: 50 },
    ];

    expect(calculateEvmWalletFundingBalance({
      balances,
      tradable_crypto_balance: { amount_usd: '93.80', token_count: 2 },
    })).toBe(93.8);
    expect(calculateEvmWalletRwaValue({
      balances,
      rwa_asset_balance: { amount_usd: '1375.00', token_count: 2 },
    })).toBe(1375);
  });

  it('uses the exact payout-token amount for funding even when its USD valuation is zero', () => {
    expect(calculateEvmWalletFundingBalance({
      exchange_payout_token_address: '0xUsdc',
      exchange_payout_token_symbol: 'USDC',
      balances: [
        { address: '0xusdc', amount: '100', symbol: 'USDC' },
        { address: '0xeth', amount: '2', symbol: 'ETH' },
      ],
      tradable_crypto_balance: { amount_usd: '0.00', token_count: 2 },
    })).toBe(100);
  });

  it('calculates funding balance from stablecoin balances when no summary exists', () => {
    expect(calculateEvmWalletFundingBalance({
      balances: {
        '0xusdc': { address: '0xusdc', amount: '10.5', symbol: 'USDC' },
        '0xdai': { address: '0xdai', amount: 4, symbol: 'DAI' },
        '0xrwa': { address: '0xrwa', amount: 2, symbol: 'RWA', price_per_usd: 50 },
      },
    })).toBe(14.5);
  });

  it('calculates RWA value from non-stablecoin balances when no summary exists', () => {
    expect(calculateEvmWalletRwaValue({
      balances: [
        { address: '0xusdc', amount: '10.5', symbol: 'USDC', price_per_usd: 1 },
        { address: '0xbond', amount: '3', symbol: 'BOND', price_per_usd: 100 },
        { address: '0xnote', amount: 2, symbol: 'NOTE', price_per_usd: 25 },
      ],
    })).toBe(350);
  });

  it('falls back to token balances for invalid summaries and returns zero for empty inputs', () => {
    expect(calculateEvmWalletFundingBalance({
      tradable_crypto_balance: { amount_usd: 'not-a-number', token_count: 1 },
      balances: [
        { address: '0xusdc', amount: '7', symbol: 'USDC' },
      ],
    })).toBe(7);
    expect(calculateEvmWalletFundingBalance({})).toBe(0);
    expect(calculateEvmWalletRwaValue({})).toBe(0);
  });
});
